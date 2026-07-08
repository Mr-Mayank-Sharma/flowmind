from __future__ import annotations

import os
from typing import Any, AsyncGenerator

from src.models import StreamChunk
from src.providers import ModelInfo, registry


class LLMRouter:
    LOCAL_THRESHOLD_TOKENS = 4096

    def __init__(self):
        self._models: list[ModelInfo] = []

    async def discover_models(self) -> list[ModelInfo]:
        self._models = await registry.discover_all()
        return self._models

    def get_available_models(self) -> list[ModelInfo]:
        return self._models

    def get_models_by_provider(self, provider: str) -> list[ModelInfo]:
        return [m for m in self._models if m.provider == provider]

    def select_provider(self, model_config: dict[str, Any]) -> tuple[str, str]:
        model_id = model_config.get("model", "")
        prefer_local = model_config.get("prefer_local", False)
        tokens = model_config.get("estimated_tokens", 0)

        if ":" in model_id or model_id in [m.id for m in self._models]:
            for m in self._models:
                if m.id == model_id or m.name == model_id:
                    return m.provider, m.id

        if prefer_local or tokens <= self.LOCAL_THRESHOLD_TOKENS:
            local = [m for m in self._models if m.local and m.available]
            if local:
                return local[0].provider, local[0].id
            return "ollama", "tinyllama:latest"

        cloud = [m for m in self._models if not m.local and m.available]
        if cloud:
            return cloud[0].provider, cloud[0].id
        return "openai", "gpt-4o-mini"

    async def stream_response(
        self, prompt: str, provider: str, model: str | None = None
    ) -> AsyncGenerator[StreamChunk, None]:
        model_id = model or "tinyllama:latest"
        messages = [{"role": "user", "content": prompt}]

        async for chunk in registry.chat(provider, model_id, messages):
            yield chunk

    async def stream_chat(
        self, provider: str, model: str, messages: list[dict], **kwargs
    ) -> AsyncGenerator[StreamChunk, None]:
        async for chunk in registry.chat(provider, model, messages, **kwargs):
            yield chunk
