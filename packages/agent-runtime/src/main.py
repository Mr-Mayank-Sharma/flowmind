from __future__ import annotations

from typing import Any, AsyncGenerator

import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from src.models import StreamChunk
from src.orchestrator import AgentOrchestrator
from src.providers import registry, OllamaProvider

app = FastAPI(title="FlowMind Agent Runtime")


class ChatRequest(BaseModel):
    session_id: str
    message: str
    user_id: str


class ChatResponse(BaseModel):
    session_id: str
    reply: str


# ── System Health ───────────────────────────────────────────────────


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


# ── Model Discovery & Management ────────────────────────────────────


@app.get("/models")
async def list_models() -> list[dict]:
    models = await registry.discover_all()
    seen = set()
    result = []
    for m in models:
        key = f"{m.provider}:{m.id}"
        if key in seen:
            continue
        seen.add(key)
        result.append({
            "id": m.id,
            "provider": m.provider,
            "name": m.name,
            "description": m.description,
            "capabilities": m.capabilities,
            "contextLength": m.context_length,
            "pricing": m.pricing,
            "local": m.local,
            "available": m.available,
            "size": m.size,
        })
    return result


@app.get("/models/providers")
async def list_providers() -> list[dict]:
    providers = registry.list_providers()
    result = []
    for name in providers:
        p = registry.get(name)
        try:
            models = await p.discover() if hasattr(p, 'discover') else []
        except Exception:
            models = []
        result.append({
            "id": name,
            "name": name.capitalize(),
            "available": any(m.available for m in models),
            "modelCount": len(models),
        })
    return result


class PullRequest(BaseModel):
    name: str


@app.post("/models/pull")
async def pull_model(body: PullRequest):
    ollama = registry.get("ollama")
    if not isinstance(ollama, OllamaProvider):
        raise HTTPException(status_code=400, detail="Ollama not available")

    return EventSourceResponse(_pull_generator(ollama, body.name))


async def _pull_generator(ollama: OllamaProvider, name: str):
    async for status in ollama.pull_model(name):
        yield {"event": "status", "data": status}


@app.post("/models/pull/status")
async def pull_model_sync(body: PullRequest) -> dict:
    ollama = registry.get("ollama")
    if not isinstance(ollama, OllamaProvider):
        raise HTTPException(status_code=400, detail="Ollama not available")

    last_status = None
    async for status in ollama.pull_model(body.name):
        last_status = status
    return {"status": last_status or "completed"}


@app.get("/models/search")
async def search_models(q: str = "") -> list[dict]:
    ollama = registry.get("ollama")
    if isinstance(ollama, OllamaProvider):
        available = await ollama.list_available()
        if q:
            available = [m for m in available if q.lower() in m.get("name", "").lower()]
        return available[:50]
    return []


# ── Knowledge / Embeddings ──────────────────────────────────────────

import math
import json
import os

KNOWLEDGE_FILE = os.path.join(os.path.dirname(__file__), "..", "data", "knowledge_store.json")

_knowledge_store: dict[str, list[dict]] = {}  # user_id -> [{id, content, embedding, metadata}]

def _load_knowledge():
    global _knowledge_store
    try:
        if os.path.exists(KNOWLEDGE_FILE):
            with open(KNOWLEDGE_FILE) as f:
                _knowledge_store = json.load(f)
    except Exception:
        _knowledge_store = {}

def _save_knowledge():
    try:
        os.makedirs(os.path.dirname(KNOWLEDGE_FILE), exist_ok=True)
        with open(KNOWLEDGE_FILE, "w") as f:
            json.dump(_knowledge_store, f)
    except Exception:
        pass

_load_knowledge()

def _cosine_sim(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(x * x for x in b))
    return dot / (na * nb) if na and nb else 0.0

async def _get_embedding(text: str) -> list[float]:
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post("http://localhost:11434/api/embeddings", json={
                "model": "all-minilm",
                "prompt": text,
            })
            data = r.json()
            return data.get("embedding", [])
    except Exception:
        return []

class IndexRequest(BaseModel):
    user_id: str
    doc_id: str
    content: str
    metadata: dict = {}

class SearchRequest(BaseModel):
    user_id: str
    query: str
    top_k: int = 5

@app.post("/knowledge/index")
async def index_document(body: IndexRequest) -> dict:
    embedding = await _get_embedding(body.content)
    store = _knowledge_store.setdefault(body.user_id, [])
    # Remove existing doc with same id
    store[:] = [d for d in store if d.get("id") != body.doc_id]
    store.append({
        "id": body.doc_id,
        "content": body.content,
        "embedding": embedding,
        "metadata": body.metadata,
    })
    _save_knowledge()
    return {"indexed": True, "doc_id": body.doc_id, "chunks": 1, "embedding_length": len(embedding)}

@app.post("/knowledge/search")
async def search_knowledge(body: SearchRequest) -> list[dict]:
    query_emb = await _get_embedding(body.query)
    if not query_emb:
        return []

    store = _knowledge_store.get(body.user_id, [])
    scored = []
    for doc in store:
        if doc["embedding"]:
            score = _cosine_sim(query_emb, doc["embedding"])
            scored.append((score, doc))
    scored.sort(key=lambda x: x[0], reverse=True)

    return [
        {
            "id": d["id"],
            "content": d["content"][:500],
            "score": round(s, 4),
            "metadata": d.get("metadata", {}),
        }
        for s, d in scored[:body.top_k]
    ]

@app.post("/knowledge/delete")
async def delete_knowledge(body: IndexRequest) -> dict:
    store = _knowledge_store.get(body.user_id, [])
    store[:] = [d for d in store if d.get("id") != body.doc_id]
    _save_knowledge()
    return {"deleted": True, "doc_id": body.doc_id}

# ── LLM Generation (for pipeline node runners) ──────────────────────

class GenerateRequest(BaseModel):
    system_prompt: str = ""
    prompt: str = ""
    model: str = "tinyllama"
    temperature: float = 0.7
    max_tokens: int = 500

@app.post("/llm/generate")
async def llm_generate(body: GenerateRequest) -> dict:
    try:
        messages = []
        if body.system_prompt:
            messages.append({"role": "system", "content": body.system_prompt})
        messages.append({"role": "user", "content": body.prompt})

        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post("http://localhost:11434/api/chat", json={
                "model": body.model,
                "messages": messages,
                "stream": False,
                "options": {
                    "temperature": body.temperature,
                    "num_predict": body.max_tokens,
                },
            })
            data = r.json()
            content = data.get("message", {}).get("content", "")
            return {
                "content": content,
                "model": body.model,
                "usage": {
                    "prompt_tokens": data.get("prompt_eval_count", 0),
                    "completion_tokens": data.get("eval_count", 0),
                },
            }
    except Exception as e:
        return {
            "content": f"Error calling LLM: {e}",
            "model": body.model,
            "error": str(e),
        }

# ── Chat ────────────────────────────────────────────────────────────


@app.post("/chat/stream")
async def chat_stream(body: ChatRequest) -> EventSourceResponse:
    orchestrator = AgentOrchestrator(user_id=body.user_id)

    async def event_generator() -> Any:
        async for chunk in orchestrator.stream_response(body.message):
            yield {"event": chunk.type, "data": chunk.model_dump_json()}

    return EventSourceResponse(event_generator())


@app.post("/chat/send", response_model=ChatResponse)
async def chat_send(body: ChatRequest) -> ChatResponse:
    orchestrator = AgentOrchestrator(user_id=body.user_id)
    reply = await orchestrator.send_message(body.message)
    return ChatResponse(session_id=body.session_id, reply=reply)
