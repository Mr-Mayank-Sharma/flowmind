from __future__ import annotations

import asyncio
import os
import re
from typing import Any, AsyncGenerator

import httpx

from src.context_engine import ContextEngine
from src.llm_router import LLMRouter
from src.models import Memory, StreamChunk
from src.resilience import ToolExecutor
from src.skill_engine import SkillEngine

API_URL = os.environ.get("FLOWMIND_API_URL", "http://localhost:3001")

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

    async def _call_llm(
        self, prompt: str
    ) -> AsyncGenerator[StreamChunk, None]:
        await self.llm_router.discover_models()
        config = {"estimated_tokens": len(prompt.split()), "prefer_local": True}
        provider_name, model_name = self.llm_router.select_provider(config)
        async for chunk in self.llm_router.stream_response(prompt, provider_name, model_name):
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

    async def _handle_tools(self, text: str, user_message: str) -> list[StreamChunk]:
        chunks: list[StreamChunk] = []
        tool_triggers = {
            "create_skill": self.skill_engine.create_skill,
        }
        for name, handler in tool_triggers.items():
            if name in text:
                chunks.append(StreamChunk.tool_call(name, {}))
                result = await handler(name=f"{name}_result", description="", code="")
                chunks.append(StreamChunk.tool_result(name, f"Skill created: {result.id}"))

        pipeline_patterns = [
            r"create\s+a\s+pipeline",
            r"create\s+a\s+workflow",
            r"make\s+a\s+pipeline",
            r"build\s+a\s+pipeline",
            r"create\s+pipeline\s+for",
        ]
        combined = f"{text} {user_message}".lower()
        if any(re.search(p, combined) for p in pipeline_patterns):
            lines = user_message.strip().split("\n")
            pipeline_name = lines[0][:80] if lines else "New Pipeline"
            pipeline_desc = user_message.strip()[:500]
            try:
                async with httpx.AsyncClient(timeout=10) as client:
                    r = await client.post(
                        f"{API_URL}/api/internal/create-pipeline",
                        json={"name": pipeline_name, "description": pipeline_desc, "userId": self.user_id},
                    )
                    if r.is_success:
                        data = r.json()
                        pipeline_id = data.get("id", "")
                        chunks.append(StreamChunk.tool_call("create_pipeline", {"pipeline_id": pipeline_id}))
                        chunks.append(StreamChunk.tool_result(
                            "create_pipeline",
                            f"Pipeline created! Open it at /pipelines/{pipeline_id}",
                        ))
                    else:
                        chunks.append(StreamChunk.tool_result("create_pipeline", f"Failed to create pipeline: {r.text}"))
            except Exception as e:
                chunks.append(StreamChunk.tool_result("create_pipeline", f"Error creating pipeline: {e}"))

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

    async def send_message(
        self, message: str, context: list[dict[str, Any]] | None = None
    ) -> str:
        tokens: list[str] = []
        async for chunk in self.stream_response(message, context):
            if chunk.type == "token":
                tokens.append(chunk.content)

        result = "".join(tokens)

        tool_chunks = await self._handle_tools(result, message)
        tool_results = [tc for tc in tool_chunks if tc.type == "tool_result"]
        if tool_results:
            result += "\n\n" + "\n".join(tc.content for tc in tool_results)

        return result
