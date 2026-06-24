from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum
from typing import Any, AsyncGenerator, Optional

from pydantic import BaseModel, Field


class StreamChunk(BaseModel):
    type: str
    content: str = ""
    metadata: dict[str, Any] = Field(default_factory=dict)

    @classmethod
    def token(cls, text: str) -> StreamChunk:
        return cls(type="token", content=text)

    @classmethod
    def done(cls) -> StreamChunk:
        return cls(type="done")

    @classmethod
    def error(cls, message: str) -> StreamChunk:
        return cls(type="error", content=message)

    @classmethod
    def tool_call(cls, name: str, args: dict[str, Any]) -> StreamChunk:
        return cls(type="tool_call", content=name, metadata={"arguments": args})

    @classmethod
    def tool_result(cls, name: str, result: str) -> StreamChunk:
        return cls(type="tool_result", content=name, metadata={"result": result})


class ContextBlock(BaseModel):
    source: str
    content: str
    relevance: float = 0.0
    metadata: dict[str, Any] = Field(default_factory=dict)


class Memory(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    content: str
    role: str = "user"
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    metadata: dict[str, Any] = Field(default_factory=dict)


class ToolCall(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    arguments: dict[str, Any] = Field(default_factory=dict)
    result: Optional[str] = None


class UserModel(BaseModel):
    id: str
    name: str
    preferences: dict[str, Any] = Field(default_factory=dict)


class Skill(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    code: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    enabled: bool = True
