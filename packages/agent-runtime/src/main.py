from __future__ import annotations

from typing import Any, AsyncGenerator

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
