from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from sqlalchemy import select

from .agents.interaction_agent import build_graph, default_interaction
from .db import SessionLocal, init_db
from .models import InteractionRecord
from .schemas import (
    ChatRequest,
    ChatResponse,
    ConversationMessage,
    GetSavedInteractionResponse,
    Interaction,
    ListSavedInteractionsResponse,
    SavedInteraction,
)
from .settings import settings

app = FastAPI(title="logAI Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup() -> None:
    try:
        init_db()
    except Exception as e:
        # DB is required for save_interaction, but we don't want the server to
        # be completely blocked if Postgres isn't running yet.
        print(f"[startup] DB init failed: {e}")


_graph = None


def _get_graph():
    global _graph
    if _graph is None:
        _graph = build_graph()
    return _graph

# Minimal in-memory session storage for chat history
_sessions: dict[str, dict] = {}


def _record_to_interaction_and_conversation(
    record: InteractionRecord,
) -> tuple[Interaction, list[dict[str, str]]]:
    data = record.data if isinstance(record.data, dict) else {}

    if isinstance(data, dict) and "interaction" in data:
        interaction_data = data.get("interaction") if isinstance(data.get("interaction"), dict) else {}
        conversation = data.get("conversation") if isinstance(data.get("conversation"), list) else []
    else:
        # Back-compat: older records stored raw interaction dict
        interaction_data = data if isinstance(data, dict) else {}
        conversation = []

    # Ensure consistent saved state on load
    interaction_data = {**interaction_data, "id": record.id, "status": "saved"}
    interaction = Interaction.model_validate(interaction_data)

    # Keep only {role, content}
    normalized_conversation: list[dict[str, str]] = []
    for m in conversation:
        if not isinstance(m, dict):
            continue
        role = m.get("role")
        content = m.get("content")
        if role not in ("user", "assistant"):
            continue
        if not isinstance(content, str):
            content = str(content) if content is not None else ""
        normalized_conversation.append({"role": role, "content": content})

    return interaction, normalized_conversation


def _restore_session_from_db(session_id: str) -> dict | None:
    """If session_id matches a saved interaction id, restore interaction + chat history."""
    try:
        with SessionLocal() as db:
            record = db.get(InteractionRecord, session_id)
            if not record:
                return None
            interaction, conversation = _record_to_interaction_and_conversation(record)

        from langchain_core.messages import AIMessage, HumanMessage

        messages = []
        for m in conversation:
            if m["role"] == "user":
                messages.append(HumanMessage(content=m["content"]))
            else:
                messages.append(AIMessage(content=m["content"]))

        return {
            "messages": messages,
            "interaction": interaction,
            "validation_errors": {},
            "conversation": conversation,
        }
    except Exception:
        return None


@app.get("/api/health")
def health() -> dict:
    return {"ok": True}


@app.get("/api/interactions", response_model=ListSavedInteractionsResponse)
def list_saved_interactions(limit: int = 20) -> ListSavedInteractionsResponse:
    """List recently saved interactions (DB-backed)."""
    limit = max(1, min(limit, 100))
    try:
        with SessionLocal() as db:
            rows = (
                db.execute(
                    select(InteractionRecord)
                    .order_by(InteractionRecord.created_at.desc())
                    .limit(limit)
                )
                .scalars()
                .all()
            )

        items = [
            SavedInteraction(
                id=r.id,
                status=r.status,
                hcpName=r.hcp_name,
                date=r.interaction_date,
                sentiment=r.sentiment,
                data=r.data,
                createdAt=r.created_at,
                updatedAt=r.updated_at,
            )
            for r in rows
        ]
        return ListSavedInteractionsResponse(items=items)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DB query failed: {e}")


@app.get("/api/interactions/{interaction_id}", response_model=GetSavedInteractionResponse)
def get_saved_interaction(interaction_id: str) -> GetSavedInteractionResponse:
    """Fetch a saved interaction including its conversation (chat history)."""
    try:
        with SessionLocal() as db:
            record = db.get(InteractionRecord, interaction_id)
            if not record:
                raise HTTPException(status_code=404, detail="Not found")

        interaction, conversation = _record_to_interaction_and_conversation(record)
        return GetSavedInteractionResponse(
            interactionState=interaction,
            conversation=[ConversationMessage(**m) for m in conversation],
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DB query failed: {e}")


@app.delete("/api/interactions/{interaction_id}")
def delete_saved_interaction(interaction_id: str) -> dict:
    """Delete a saved interaction (DB-backed)."""
    try:
        with SessionLocal() as db:
            record = db.get(InteractionRecord, interaction_id)
            if not record:
                raise HTTPException(status_code=404, detail="Not found")
            db.delete(record)
            db.commit()
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DB delete failed: {e}")


@app.post("/api/chat", response_model=ChatResponse)
def chat(req: ChatRequest) -> ChatResponse:
    try:
        graph = _get_graph()
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

    session = _sessions.get(req.sessionId)
    if not session:
        session = _restore_session_from_db(req.sessionId) or {
            "messages": [],
            "interaction": default_interaction(),
            "validation_errors": {},
            "conversation": [],
        }
        _sessions[req.sessionId] = session

    # Keep server in sync with client-side state
    session["interaction"] = req.interactionState

    # Track whether this request resulted in a new save
    before_id = getattr(session["interaction"], "id", None)

    # Append user message
    from langchain_core.messages import HumanMessage

    session["messages"].append(HumanMessage(content=req.message))
    session["messages"] = session["messages"][-20:]

    conversation = session.get("conversation")
    if not isinstance(conversation, list):
        conversation = []
    conversation.append({"role": "user", "content": req.message})
    session["conversation"] = conversation[-40:]

    result = graph.invoke(
        {
            "messages": session["messages"],
            "interaction": session["interaction"],
            "validation_errors": session["validation_errors"],
        }
    )

    session["messages"] = result["messages"]
    session["interaction"] = result["interaction"]
    session["validation_errors"] = result.get("validation_errors", {})

    # Find last assistant message content
    assistant_message = ""
    for m in reversed(result["messages"]):
        if getattr(m, "type", None) == "ai":
            assistant_message = m.content
            break

    # Enforce exact post-log reply template (avoids prompt drift).
    try:
        from langchain_core.messages import AIMessage

        last_human_idx = None
        for i in range(len(result["messages"]) - 1, -1, -1):
            if getattr(result["messages"][i], "type", None) == "human":
                last_human_idx = i
                break

        tools_used: set[str] = set()
        if last_human_idx is not None:
            for msg in result["messages"][last_human_idx:]:
                if isinstance(msg, AIMessage) and msg.tool_calls:
                    for tc in msg.tool_calls:
                        if isinstance(tc, dict):
                            name = tc.get("name")
                        else:
                            name = getattr(tc, "name", None)
                        if name:
                            tools_used.add(str(name))

        if "log_interaction" in tools_used:
            assistant_message = (
                "Interaction logged successfully. The details have been automatically added according to your summary. "
                "Would you like me to suggest a specific follow-up action, such as schedule a meeting?"
            )
    except Exception:
        pass

    # Persist assistant message into conversation
    conversation = session.get("conversation")
    if not isinstance(conversation, list):
        conversation = []
    conversation.append({"role": "assistant", "content": assistant_message})
    session["conversation"] = conversation[-40:]

    # If the interaction was saved this turn, persist chat history into the saved record.
    after_id = getattr(session["interaction"], "id", None)
    if after_id and after_id != before_id:
        try:
            with SessionLocal() as db:
                record = db.get(InteractionRecord, after_id)
                if record:
                    interaction_dump = session["interaction"].model_dump()
                    existing = record.data if isinstance(record.data, dict) else {}
                    if isinstance(existing, dict) and "interaction" in existing:
                        payload = dict(existing)
                    else:
                        payload = {"interaction": existing if isinstance(existing, dict) else {}, "conversation": []}

                    payload["interaction"] = interaction_dump
                    payload["conversation"] = session["conversation"]

                    record.data = payload
                    record.status = "saved"
                    record.hcp_name = session["interaction"].hcpName
                    record.interaction_date = session["interaction"].date
                    record.sentiment = session["interaction"].sentiment
                    db.add(record)
                    db.commit()
        except Exception as e:
            print(f"[chat] failed to persist conversation for {after_id}: {e}")

    return ChatResponse(
        assistantMessage=assistant_message,
        interactionState=session["interaction"],
        validationErrors=session["validation_errors"],
    )
