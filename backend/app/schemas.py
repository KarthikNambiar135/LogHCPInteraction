from __future__ import annotations

from typing import Literal
from datetime import datetime

from pydantic import BaseModel, Field


Sentiment = Literal["positive", "neutral", "negative"]


class Interaction(BaseModel):
    id: str | None = None
    status: Literal["draft", "saved"] = "draft"

    hcpName: str | None = None
    interactionType: str | None = None
    date: str | None = None  # ISO date: YYYY-MM-DD
    time: str | None = None  # HH:MM

    attendees: list[str] = Field(default_factory=list)
    topicsDiscussed: list[str] = Field(default_factory=list)
    materialsShared: list[str] = Field(default_factory=list)
    samplesDistributed: list[str] = Field(default_factory=list)

    sentiment: Sentiment | None = None

    outcomes: str | None = None
    followUpActions: list[str] = Field(default_factory=list)

    aiSuggestedFollowUps: list[str] = Field(default_factory=list)


class ChatRequest(BaseModel):
    sessionId: str
    message: str
    interactionState: Interaction


class ChatResponse(BaseModel):
    assistantMessage: str
    interactionState: Interaction
    validationErrors: dict[str, str] = Field(default_factory=dict)


class SavedInteraction(BaseModel):
    id: str
    status: str

    hcpName: str | None = None
    date: str | None = None
    sentiment: str | None = None

    data: dict
    createdAt: datetime
    updatedAt: datetime


class ListSavedInteractionsResponse(BaseModel):
    items: list[SavedInteraction] = Field(default_factory=list)


class ConversationMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class GetSavedInteractionResponse(BaseModel):
    interactionState: Interaction
    conversation: list[ConversationMessage] = Field(default_factory=list)
