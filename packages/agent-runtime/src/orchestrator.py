from __future__ import annotations

import asyncio
from typing import Any, AsyncGenerator

from src.context_engine import ContextEngine
from src.llm_router import LLMRouter
from src.models import Memory, StreamChunk
from src.resilience import ToolExecutor, with_retry
from src.skill_engine import SkillEngine

SYSTEM_PROMPT = (
    "You are FlowMind Agent, an AI assistant that helps users build and manage workflows. "
    "You have access to context, skills, and tools. Be concise and helpful."
)


class AgentOrchestrator:
    def __init__(self, user_id: str) -> None:
        self.user_id = user_id
        self.context_engine = ContextEngine()
        self.skill_engine = SkillEngine()
        self.llm_router = LLMRouter()
        self.tool_executor = ToolExecutor()
        self._history: list[Memory] = []

    @with_retry(max_retries=3, base_delay=0.5)
    async def _call_llm(
        self, prompt: str
    ) -> AsyncGenerator[StreamChunk, None]:
        config = {"estimated_tokens": len(prompt.split()), "prefer_local": True}
        provider = self.llm_router.select_provider(config)
        async for chunk in self.llm_router.stream_response(prompt, provider):
            yield chunk

    async def _build_prompt(self, message: str, context_blocks: list[dict[str, Any]]) -> str:
        parts = [SYSTEM_PROMPT]

        if context_blocks:
            ctx_text = "\n".join(
                f"[{b.get('source', 'unknown')}]: {b.get('content', '')}"
                for b in context_blocks
            )
            parts.append(f"Relevant context:\n{ctx_text}")

        if self._history:
            history_text = "\n".join(
                f"{m.role}: {m.content}" for m in self._history[-10:]
            )
            parts.append(f"Conversation history:\n{history_text}")

        parts.append(f"User: {message}")
        return "\n\n".join(parts)

    async def _handle_tools(self, text: str) -> list[StreamChunk]:
        chunks: list[StreamChunk] = []
        tool_triggers = {
            "create_skill": self.skill_engine.create_skill,
        }
        for name, handler in tool_triggers.items():
            if name in text:
                chunks.append(StreamChunk.tool_call(name, {}))
                result = await handler(name=f"{name}_result", description="", code="")
                chunks.append(StreamChunk.tool_result(name, f"Skill created: {result.id}"))
        return chunks

    async def stream_response(
        self, message: str, context: list[dict[str, Any]] | None = None
    ) -> AsyncGenerator[StreamChunk, None]:
        context_blocks = context or []

        self._history.append(Memory(user_id=self.user_id, content=message, role="user"))

        prompt = await self._build_prompt(message, context_blocks)

        async for chunk in self._call_llm(prompt):
            yield chunk
            if chunk.type == "done":
                self._history.append(
                    Memory(
                        user_id=self.user_id,
                        content="",
                        role="assistant",
                        metadata={"stream_complete": True},
                    )
                )

        tool_chunks = await self._handle_tools(prompt)
        for tc in tool_chunks:
            yield tc

    async def send_message(
        self, message: str, context: list[dict[str, Any]] | None = None
    ) -> str:
        tokens: list[str] = []
        async for chunk in self.stream_response(message, context):
            if chunk.type == "token":
                tokens.append(chunk.content)
        return "".join(tokens)
