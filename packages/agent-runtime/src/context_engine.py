from __future__ import annotations

import asyncio
import hashlib
import os
import uuid
from typing import Any

from src.models import ContextBlock

try:
    from qdrant_client import QdrantClient
    from qdrant_client.models import (
        Distance,
        PointStruct,
        VectorParams,
        Filter,
        FieldCondition,
        MatchValue,
    )

    QDRANT_AVAILABLE = True
except ImportError:
    QDRANT_AVAILABLE = False


class ContextEngine:
    def __init__(self, qdrant_url: str | None = None, embedding_dim: int = 384) -> None:
        self._qdrant_url = qdrant_url
        self._use_mock = qdrant_url is None
        self._mock_contexts: dict[str, list[dict[str, Any]]] = {}
        self._embedding_dim = embedding_dim
        self._client: "QdrantClient | None" = None
        self._collection_name = "flowmind_contexts"

        if qdrant_url and QDRANT_AVAILABLE:
            try:
                self._client = QdrantClient(url=qdrant_url)
                self._ensure_collection()
                self._use_mock = False
            except Exception:
                self._use_mock = True
                self._client = None

    @property
    def is_mock(self) -> bool:
        return self._use_mock

    def _ensure_collection(self) -> None:
        if not self._client:
            return
        try:
            collections = self._client.get_collections().collections
            collection_names = [c.name for c in collections]
            if self._collection_name not in collection_names:
                self._client.create_collection(
                    collection_name=self._collection_name,
                    vectors_config=VectorParams(
                        size=self._embedding_dim,
                        distance=Distance.COSINE,
                    ),
                )
        except Exception:
            pass

    def _get_embedding(self, text: str) -> list[float]:
        import hashlib
        hash_bytes = hashlib.md5(text.encode()).digest()
        embedding = []
        for i in range(self._embedding_dim):
            byte_val = hash_bytes[i % len(hash_bytes)]
            embedding.append((byte_val / 127.5) - 1.0)
        norm = sum(x * x for x in embedding) ** 0.5
        if norm > 0:
            embedding = [x / norm for x in embedding]
        return embedding

    def _get_embedding_from_ollama(self, text: str) -> list[float]:
        try:
            import httpx
            ollama_url = os.environ.get("OLLAMA_URL", "http://localhost:11434")
            with httpx.Client(timeout=10.0) as client:
                resp = client.post(
                    f"{ollama_url}/api/embeddings",
                    json={"model": "all-minilm", "prompt": text},
                )
                if resp.status_code == 200:
                    return resp.json()["embedding"]
        except Exception:
            pass
        return self._get_embedding(text)

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
        if not self._client:
            return await self._mock_retrieve(user_id, query, top_k)

        try:
            query_vector = self._get_embedding_from_ollama(query)
            query_filter = Filter(
                must=[
                    FieldCondition(
                        key="user_id",
                        match=MatchValue(value=user_id),
                    )
                ]
            )

            if hasattr(self._client, "query_points"):
                response = self._client.query_points(
                    collection_name=self._collection_name,
                    query=query_vector,
                    limit=top_k,
                    query_filter=query_filter,
                )
                results = response.points
            else:
                results = self._client.search(
                    collection_name=self._collection_name,
                    query_vector=query_vector,
                    limit=top_k,
                    query_filter=query_filter,
                )

            return [
                ContextBlock(
                    source=hit.payload.get("source", "knowledge"),
                    content=hit.payload.get("content", ""),
                    relevance=hit.score,
                    metadata={
                        **hit.payload.get("metadata", {}),
                        **{
                            k: v
                            for k, v in (hit.payload or {}).items()
                            if k not in ("source", "content", "user_id", "metadata")
                        },
                    },
                )
                for hit in results
            ]
        except Exception:
            return await self._mock_retrieve(user_id, query, top_k)

    async def _vector_ingest(self, user_id: str, documents: list[dict[str, Any]]) -> None:
        if not self._client:
            self._mock_contexts.setdefault(user_id, []).extend(documents)
            return

        try:
            points = []
            for i, doc in enumerate(documents):
                content = doc.get("content", "")
                vector = self._get_embedding_from_ollama(content)

                doc_id = doc.get("id") or hashlib.md5(
                    f"{user_id}:{content[:100]}".encode()
                ).hexdigest()
                point_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"{user_id}:{doc_id}:{i}"))

                points.append(
                    PointStruct(
                        id=point_id,
                        vector=vector,
                        payload={
                            "user_id": user_id,
                            "source": doc.get("source", "upload"),
                            "content": content,
                            "metadata": doc.get("metadata", {}),
                            **{
                                k: v
                                for k, v in doc.items()
                                if k not in ("content", "source", "id", "metadata")
                            },
                        },
                    )
                )

            if points:
                self._client.upsert(
                    collection_name=self._collection_name,
                    points=points,
                )
        except Exception:
            self._mock_contexts.setdefault(user_id, []).extend(documents)

    async def delete_by_user(self, user_id: str) -> None:
        if not self._client:
            self._mock_contexts.pop(user_id, None)
            return

        try:
            self._client.delete(
                collection_name=self._collection_name,
                points_selector=Filter(
                    must=[
                        FieldCondition(
                            key="user_id",
                            match=MatchValue(value=user_id),
                        )
                    ]
                ),
            )
        except Exception:
            pass

    async def delete_by_document(self, user_id: str, doc_id: str) -> None:
        if not self._client:
            return

        try:
            self._client.delete(
                collection_name=self._collection_name,
                points_selector=[doc_id],
            )
        except Exception:
            pass
