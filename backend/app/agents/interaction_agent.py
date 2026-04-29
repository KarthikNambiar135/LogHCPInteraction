from __future__ import annotations

import ast
import json
import uuid
from datetime import date, datetime
from typing import Annotated, Any, TypedDict

from langchain_core.messages import AIMessage, BaseMessage, SystemMessage
from langchain_core.tools import tool
from langchain_groq import ChatGroq
from langgraph.graph import END, StateGraph
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode

from ..db import SessionLocal
from ..models import InteractionRecord
from ..schemas import Interaction
from ..settings import settings


class AgentState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    interaction: Interaction
    validation_errors: dict[str, str]


REQUIRED_FIELDS: dict[str, str] = {
    "hcpName": "HCP name is required",
    "interactionType": "Interaction type is required",
    "date": "Date is required",
    "sentiment": "Sentiment is required",
}


def default_interaction() -> Interaction:
    now = datetime.now()
    return Interaction(
        id=None,
        status="draft",
        hcpName=None,
        interactionType="Meeting",
        date=now.date().isoformat(),
        time=now.strftime("%H:%M"),
        attendees=[],
        topicsDiscussed=[],
        materialsShared=[],
        samplesDistributed=[],
        sentiment="neutral",
        outcomes=None,
        followUpActions=[],
        aiSuggestedFollowUps=[],
    )


def merge_interaction(current: Interaction, patch: dict[str, Any]) -> Interaction:
    data = current.model_dump()
    for key, value in patch.items():
        if value is None:
            continue
        data[key] = value
    return Interaction.model_validate(data)


@tool
def log_interaction(
    hcpName: str | None = None,
    interactionType: str | None = None,
    date: str | None = None,
    time: str | None = None,
    attendees: list[str] | None = None,
    topicsDiscussed: list[str] | None = None,
    materialsShared: list[str] | None = None,
    samplesDistributed: list[str] | None = None,
    sentiment: str | None = None,
    outcomes: str | None = None,
    followUpActions: list[str] | None = None,
) -> dict[str, Any]:
    """Extract a new interaction from the user's narrative and populate the form."""
    interaction = default_interaction().model_dump()
    patch: dict[str, Any] = {
        "hcpName": hcpName,
        "interactionType": interactionType,
        "date": date,
        "time": time,
        "attendees": attendees,
        "topicsDiscussed": topicsDiscussed,
        "materialsShared": materialsShared,
        "samplesDistributed": samplesDistributed,
        "sentiment": sentiment,
        "outcomes": outcomes,
        "followUpActions": followUpActions,
    }

    for k, v in patch.items():
        if v is not None:
            interaction[k] = v

    return {"interaction": interaction, "mode": "replace"}


@tool
def edit_interaction(
    hcpName: str | None = None,
    interactionType: str | None = None,
    date: str | None = None,
    time: str | None = None,
    attendees: list[str] | None = None,
    topicsDiscussed: list[str] | None = None,
    materialsShared: list[str] | None = None,
    samplesDistributed: list[str] | None = None,
    sentiment: str | None = None,
    outcomes: str | None = None,
    followUpActions: list[str] | None = None,
) -> dict[str, Any]:
    """Edit specific fields in the existing interaction; only provided fields change."""
    patch: dict[str, Any] = {
        "hcpName": hcpName,
        "interactionType": interactionType,
        "date": date,
        "time": time,
        "attendees": attendees,
        "topicsDiscussed": topicsDiscussed,
        "materialsShared": materialsShared,
        "samplesDistributed": samplesDistributed,
        "sentiment": sentiment,
        "outcomes": outcomes,
        "followUpActions": followUpActions,
    }
    # Drop Nones so the backend can merge cleanly
    patch = {k: v for k, v in patch.items() if v is not None}
    return {"patch": patch, "mode": "patch"}


@tool
def reset_interaction() -> dict[str, Any]:
    """Reset the form to a blank draft interaction."""
    return {"interaction": default_interaction().model_dump(), "mode": "replace"}


@tool
def validate_interaction(interaction: dict[str, Any]) -> dict[str, Any]:
    """Validate required fields and return a structured error map."""
    errors: dict[str, str] = {}
    for field, message in REQUIRED_FIELDS.items():
        value = interaction.get(field)
        if value is None or (isinstance(value, str) and not value.strip()):
            errors[field] = message
    return {"validationErrors": errors}


@tool
def save_interaction(interaction: dict[str, Any]) -> dict[str, Any]:
    """Persist the interaction to SQL and return the saved record id."""
    try:
        new_id = str(uuid.uuid4())
        interaction_to_store = dict(interaction)
        interaction_to_store["id"] = new_id
        interaction_to_store["status"] = "saved"

        with SessionLocal() as db:
            record = InteractionRecord(
                id=new_id,
                status="saved",
                hcp_name=interaction_to_store.get("hcpName"),
                interaction_date=interaction_to_store.get("date"),
                sentiment=interaction_to_store.get("sentiment"),
                data={"interaction": interaction_to_store, "conversation": []},
            )
            db.add(record)
            db.commit()
            db.refresh(record)
        return {"savedId": record.id}
    except Exception as e:
        return {
            "saveError": (
                "Failed to save interaction to the database. "
                "Verify DATABASE_URL and that Postgres is running. "
                f"Details: {e}"
            )
        }


@tool
def set_ai_suggested_followups(suggestions: list[str]) -> dict[str, Any]:
    """Set AI-suggested follow-up actions (a read-only list shown in the form)."""
    return {"patch": {"aiSuggestedFollowUps": suggestions}, "mode": "patch"}


def _system_prompt(current_interaction: Interaction) -> str:
    today = date.today().isoformat()
    interaction_json = json.dumps(current_interaction.model_dump(), ensure_ascii=False, indent=2)

    return (
        "You are an AI assistant that controls an HCP interaction logging form. "
        "The user will chat with you; you must use tools to update the form state.\n\n"
        "Rules:\n"
        "- NEVER tell the user to manually edit the form.\n"
        "- To change form fields, you MUST call one of the tools: log_interaction, edit_interaction, reset_interaction, validate_interaction, save_interaction, set_ai_suggested_followups.\n"
        "- If the user provides a brand new narrative, call log_interaction with extracted fields.\n"
        "- If the user corrects specific details, call edit_interaction with ONLY the corrected fields.\n"
        "- If the user asks to reset, call reset_interaction.\n"
        "- If the user asks to validate, call validate_interaction(interaction=<CURRENT_FORM_STATE_JSON>).\n"
        "- If the user asks to save, call validate_interaction(interaction=<CURRENT_FORM_STATE_JSON>) first if needed, then save_interaction(interaction=<CURRENT_FORM_STATE_JSON>).\n\n"
        "Response style:\n"
        "- After you successfully call log_interaction, your final message to the user MUST be exactly:\n"
        '  Interaction logged successfully. The details have been automatically added according to your summary. Would you like me to suggest a specific follow-up action, such as schedule a meeting?\n'
        "- If the user asks for follow-up suggestions, call set_ai_suggested_followups with 2-4 specific, actionable suggestions, then briefly present them.\n\n"
        f"Today is {today}. Output dates as YYYY-MM-DD and time as HH:MM (24h).\n\n"
        "Current form state (JSON):\n"
        f"{interaction_json}\n"
    )


def build_graph() -> Any:
    tools = [
        log_interaction,
        edit_interaction,
        reset_interaction,
        validate_interaction,
        save_interaction,
        set_ai_suggested_followups,
    ]

    def get_model(model_name: str) -> ChatGroq:
        if not settings.groq_api_key:
            raise RuntimeError("GROQ_API_KEY is missing; set it in backend/.env")
        return ChatGroq(api_key=settings.groq_api_key, model=model_name, temperature=0)

    model_primary = get_model(settings.groq_model)
    model_fallback = get_model(settings.groq_fallback_model)

    model_primary = model_primary.bind_tools(tools)
    model_fallback = model_fallback.bind_tools(tools)

    tool_node = ToolNode(tools)

    def assistant(state: AgentState) -> dict[str, Any]:
        system = SystemMessage(content=_system_prompt(state["interaction"]))
        try:
            response = model_primary.invoke([system, *state["messages"]])
        except Exception:
            response = model_fallback.invoke([system, *state["messages"]])

        if isinstance(response, AIMessage) and response.tool_calls:
            tool_names: list[str] = []
            for tc in response.tool_calls:
                if isinstance(tc, dict):
                    tool_names.append(str(tc.get("name")))
                else:
                    tool_names.append(str(getattr(tc, "name", tc)))
            print(f"[agent] tool_calls={tool_names}")
        return {"messages": [response]}

    def should_continue(state: AgentState) -> str:
        last = state["messages"][-1]
        if isinstance(last, AIMessage) and last.tool_calls:
            return "tools"
        return "end"

    def apply_tool_outputs(state: AgentState) -> dict[str, Any]:
        """Parse tool messages and update interaction + validation error state."""
        interaction = state["interaction"]
        validation_errors: dict[str, str] = {}

        # Only look at the most recent tool messages since the last AI tool call.
        # ToolNode appends ToolMessage(s) to state["messages"].
        for msg in reversed(state["messages"]):
            if isinstance(msg, AIMessage):
                break
            if getattr(msg, "type", None) != "tool":
                continue
            try:
                payload = json.loads(msg.content)
            except Exception:
                try:
                    payload = ast.literal_eval(msg.content)
                except Exception:
                    continue

            if isinstance(payload, dict):
                if payload.get("mode") == "replace" and "interaction" in payload:
                    interaction = Interaction.model_validate(payload["interaction"])
                if payload.get("mode") == "patch" and "patch" in payload:
                    interaction = merge_interaction(interaction, payload["patch"])
                if "validationErrors" in payload and isinstance(payload["validationErrors"], dict):
                    validation_errors = payload["validationErrors"]
                if "savedId" in payload:
                    interaction = merge_interaction(interaction, {"id": payload["savedId"], "status": "saved"})

        return {"interaction": interaction, "validation_errors": validation_errors}

    graph = StateGraph(AgentState)
    graph.add_node("assistant", assistant)
    graph.add_node("tools", tool_node)
    graph.add_node("apply", apply_tool_outputs)

    graph.set_entry_point("assistant")
    graph.add_conditional_edges("assistant", should_continue, {"tools": "tools", "end": END})
    graph.add_edge("tools", "apply")
    graph.add_edge("apply", "assistant")

    return graph.compile()
