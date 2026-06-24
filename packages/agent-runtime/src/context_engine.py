from __future__ import annotations

import asyncio
from typing import Any

from src.models import ContextBlock


class ContextEngine:
    def __init__(self, qdrant_url: str | None = None) -> None:
        self._qdrant_url = qdrant_url
        self._use_mock = qdrant_url is None
        self._mock_contexts: dict[str, list[dict[str, Any]]] = {}

    async def ingest(self, user_id: str, documents: list[dict[str, Any]]) -> None:
        if self._use_mock:
            self._mock_contexts.setdefault(user_id, []).extend(documents)
            return

        await self._vector_ingest(user_id, documents)

    async def retrieve_context(
        self, user_id: str, query: str, top_k: int = 5
    ) -> list[ContextBlock]:
        if self._use_mock:
            return await self._mock_retrieve(user_id, query, top_k)

        return await self._vector_search(user_id, query, top_k)

    async def _mock_retrieve(
        self, user_id: str, query: str, top_k: int
    ) -> list[ContextBlock]:
        await asyncio.sleep(0.05)
        docs = self._mock_contexts.get(user_id, [])
        results = docs[:top_k]

        return [
            ContextBlock(
                source=d.get("source", "memory"),
                content=d.get("content", ""),
                relevance=1.0 - (i * 0.1),
                metadata={k: v for k, v in d.items() if k not in ("source", "content")},
            )
            for i, d in enumerate(results)
        ]

    async def _vector_search(
        self, user_id: str, query: str, top_k: int
    ) -> list[ContextBlock]:
        raise NotImplementedError("Qdrant integration not yet wired")

    async def _vector_ingest(self, user_id: str, documents: list[dict[str, Any]]) -> None:
        raise NotImplementedError("Qdrant integration not yet wired")
