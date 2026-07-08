from __future__ import annotations

import asyncio
import json
import os
from typing import Any, AsyncGenerator
from dataclasses import dataclass, field

import httpx

from src.models import StreamChunk


@dataclass
class ModelInfo:
    id: str
    provider: str
    name: str
    description: str = ""
    capabilities: list[str] = field(default_factory=lambda: ["text"])
    context_length: int = 4096
    pricing: str = ""
    local: bool = True
    available: bool = False
    size: str = ""


# ── Provider Registry ─────────────────────────────────────────────────


class ProviderRegistry:
    def __init__(self):
        self._providers: dict[str, "BaseProvider"] = {}
        self._models: list[ModelInfo] = []

    def register(self, provider: "BaseProvider"):
        self._providers[provider.name] = provider

    def get(self, name: str) -> "BaseProvider | None":
        return self._providers.get(name)

    def list_providers(self) -> list[str]:
        return list(self._providers.keys())

    async def discover_all(self) -> list[ModelInfo]:
        all_models: list[ModelInfo] = []
        for provider in self._providers.values():
            try:
                models = await asyncio.wait_for(provider.discover(), timeout=5)
                all_models.extend(models)
            except Exception:
                pass
        self._models = all_models
        return all_models

    async def chat(
        self, provider: str, model: str, messages: list[dict], **kwargs
    ) -> AsyncGenerator[StreamChunk, None]:
        p = self._providers.get(provider)
        if not p:
            yield StreamChunk.error(f"Unknown provider: {provider}")
            return
        async for chunk in p.chat(model, messages, **kwargs):
            yield chunk


registry = ProviderRegistry()


# ── Base Provider ────────────────────────────────────────────────────


class BaseProvider:
    name: str = "base"

    async def discover(self) -> list[ModelInfo]:
        return []

    async def chat(
        self, model: str, messages: list[dict], **kwargs
    ) -> AsyncGenerator[StreamChunk, None]:
        yield StreamChunk.error(f"Provider {self.name} not implemented")
        return


# ── Ollama Provider ──────────────────────────────────────────────────


OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://localhost:11434")


class OllamaProvider(BaseProvider):
    name = "ollama"

    async def _request(self, method: str, path: str, **kwargs) -> Any:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.request(method, f"{OLLAMA_HOST}{path}", **kwargs)
            r.raise_for_status()
            return r

    POPULAR_MODELS = [
        ("llama3.2", "3B", 8192, "Meta's latest compact model, fast and capable"),
        ("llama3.2-vision", "11B", 8192, "Meta's multimodal model with vision support"),
        ("llama3.1", "8B", 131072, "Meta's flagship open model with 128K context"),
        ("mistral", "7B", 32768, "Mistral AI's efficient 7B model"),
        ("mixtral", "8x7B", 32768, "Mistral AI's mixture-of-experts model"),
        ("codellama", "7B", 16384, "Meta's code-specialized Llama variant"),
        ("phi3", "3.8B", 131072, "Microsoft Phi-3 mini efficient model"),
        ("phi3-medium", "14B", 131072, "Microsoft Phi-3 medium model"),
        ("gemma2", "2B", 8192, "Google's lightweight Gemma 2 model"),
        ("qwen2.5", "7B", 32768, "Alibaba's Qwen 2.5 general model"),
        ("deepseek-r1", "7B", 131072, "DeepSeek's reasoning model"),
        ("command-r", "35B", 131072, "Cohere's RAG-optimized model"),
        ("nomic-embed-text", "137M", 2048, "Nomic's embedding model for RAG"),
        ("llava", "7B", 4096, "LLaVA multimodal vision-language model"),
    ]

    async def _get_model_capabilities(self, name: str) -> list[str]:
        try:
            r = await self._request("POST", "/api/show", json={"name": name})
            data = r.json()
            return data.get("capabilities", ["text"])
        except Exception:
            return ["text"]

    _EMBEDDING_FAMILIES = {"bert", "nomic-bert", "gte", "bge"}

    async def discover(self) -> list[ModelInfo]:
        models: list[ModelInfo] = []
        pulled = set()
        try:
            r = await self._request("GET", "/api/tags")
            data = r.json()
            for m in data.get("models", []):
                name = m["name"]
                pulled.add(name.split(":")[0])
                caps = await self._get_model_capabilities(name)
                can_chat = any(c in caps for c in ("chat", "completion", "vision"))
                models.append(
                    ModelInfo(
                        id=name,
                        provider="ollama",
                        name=name,
                        description=f"Ollama local model ({_fmt_size(m.get('size', 0))})",
                        capabilities=caps,
                        context_length=8192,
                        local=True,
                        available=can_chat,
                        size=_fmt_size(m.get("size", 0)),
                    )
                )
        except Exception:
            pass

        for mname, size_str, ctx, desc in self.POPULAR_MODELS:
            if mname not in pulled:
                models.append(
                    ModelInfo(
                        id=mname,
                        provider="ollama",
                        name=mname,
                        description=f"{desc} — available for pull ({size_str})",
                        capabilities=["text"],
                        context_length=ctx,
                        local=True,
                        available=False,
                        size=size_str,
                    )
                )
        return models

    async def chat(
        self, model: str, messages: list[dict], **kwargs
    ) -> AsyncGenerator[StreamChunk, None]:
        try:
            async with httpx.AsyncClient(timeout=120) as client:
                async with client.stream(
                    "POST",
                    f"{OLLAMA_HOST}/api/chat",
                    json={"model": model, "messages": messages, "stream": True},
                ) as resp:
                    async for line in resp.aiter_lines():
                        if not line.strip():
                            continue
                        try:
                            data = json.loads(line)
                        except json.JSONDecodeError:
                            continue
                        if "message" in data and "content" in data["message"]:
                            yield StreamChunk.token(data["message"]["content"])
                        if data.get("done"):
                            yield StreamChunk.done()
                            return
        except Exception as e:
            yield StreamChunk.error(f"Ollama error: {e}")

    async def pull_model(self, name: str) -> AsyncGenerator[str, None]:
        try:
            async with httpx.AsyncClient(timeout=600) as client:
                async with client.stream(
                    "POST", f"{OLLAMA_HOST}/api/pull", json={"name": name}
                ) as resp:
                    async for line in resp.aiter_lines():
                        if not line.strip():
                            continue
                        try:
                            data = json.loads(line)
                        except json.JSONDecodeError:
                            continue
                        yield data.get("status", "")
                        if data.get("completed"):
                            return
        except Exception as e:
            yield f"error: {e}"

    async def list_available(self) -> list[dict]:
        try:
            r = await self._request("GET", "https://ollama.com/api/tags")
            return r.json().get("models", [])
        except Exception:
            return []


# ── HuggingFace Provider ────────────────────────────────────────────


class HuggingFaceProvider(BaseProvider):
    name = "huggingface"

    async def discover(self) -> list[ModelInfo]:
        models: list[ModelInfo] = []
        try:
            import torch
            from transformers import pipeline

            models.append(
                ModelInfo(
                    id="transformers-pipeline",
                    provider="huggingface",
                    name="HuggingFace Transformers (local)",
                    description=f"PyTorch {torch.__version__} with transformers pipeline",
                    capabilities=["text"],
                    context_length=2048,
                    local=True,
                    available=True,
                    size="SDK installed",
                )
            )
        except ImportError:
            pass

        hf_cache = os.path.expanduser("~/.cache/huggingface/hub")
        if os.path.isdir(hf_cache):
            try:
                for entry in os.listdir(hf_cache):
                    if entry.startswith("models--"):
                        name = entry.replace("models--", "").replace("--", "/")
                        models.append(
                            ModelInfo(
                                id=name,
                                provider="huggingface",
                                name=name,
                                description="Cached HuggingFace model",
                                capabilities=["text"],
                                context_length=2048,
                                local=True,
                                available=True,
                                size="cached",
                            )
                        )
            except Exception:
                pass
        return models

    async def chat(
        self, model: str, messages: list[dict], **kwargs
    ) -> AsyncGenerator[StreamChunk, None]:
        last = messages[-1]["content"] if messages else ""
        try:
            from transformers import pipeline as hf_pipeline

            pipe = hf_pipeline("text-generation", model=model or "gpt2")
            out = pipe(last, max_length=200, do_sample=True)[0]["generated_text"]
            for word in out.split():
                yield StreamChunk.token(word + " ")
                await asyncio.sleep(0.01)
            yield StreamChunk.done()
        except Exception as e:
            yield StreamChunk.error(f"HF error: {e}")


# ── OpenAI Provider ──────────────────────────────────────────────────


class OpenAIProvider(BaseProvider):
    name = "openai"

    async def discover(self) -> list[ModelInfo]:
        api_key = os.environ.get("OPENAI_API_KEY", "")
        if not api_key:
            return [
                ModelInfo(
                    id="gpt-4o",
                    provider="openai",
                    name="GPT-4o",
                    description="OpenAI flagship model (requires API key)",
                    capabilities=["text", "vision", "code"],
                    context_length=128000,
                    pricing="$2.50/$10.00 per 1M tokens",
                    local=False,
                    available=False,
                ),
                ModelInfo(
                    id="gpt-4o-mini",
                    provider="openai",
                    name="GPT-4o Mini",
                    description="Fast, affordable OpenAI model (requires API key)",
                    capabilities=["text", "vision", "code"],
                    context_length=128000,
                    pricing="$0.15/$0.60 per 1M tokens",
                    local=False,
                    available=False,
                ),
                ModelInfo(
                    id="gpt-4-turbo",
                    provider="openai",
                    name="GPT-4 Turbo",
                    description="High-performance OpenAI model (requires API key)",
                    capabilities=["text", "code", "vision"],
                    context_length=128000,
                    pricing="$10.00/$30.00 per 1M tokens",
                    local=False,
                    available=False,
                ),
                ModelInfo(
                    id="gpt-3.5-turbo",
                    provider="openai",
                    name="GPT-3.5 Turbo",
                    description="Fast, cost-effective OpenAI model (requires API key)",
                    capabilities=["text", "code"],
                    context_length=16385,
                    pricing="$0.50/$1.50 per 1M tokens",
                    local=False,
                    available=False,
                ),
            ]
        try:
            import openai as oai
            client = oai.AsyncClient(api_key=api_key)
            models_list = await client.models.list()
            result = []
            for m in models_list:
                result.append(
                    ModelInfo(
                        id=m.id,
                        provider="openai",
                        name=m.id,
                        description=f"OpenAI model (via API key)",
                        capabilities=["text"],
                        context_length=128000,
                        local=False,
                        available=True,
                    )
                )
            return result
        except Exception as e:
            return [
                ModelInfo(
                    id="gpt-4o",
                    provider="openai",
                    name="GPT-4o",
                    description=f"OpenAI (API key invalid: {e})",
                    capabilities=["text", "vision", "code"],
                    context_length=128000,
                    local=False,
                    available=False,
                ),
            ]

    async def chat(
        self, model: str, messages: list[dict], **kwargs
    ) -> AsyncGenerator[StreamChunk, None]:
        api_key = os.environ.get("OPENAI_API_KEY", "")
        if not api_key:
            yield StreamChunk.error("OPENAI_API_KEY not configured")
            return
        try:
            import openai as oai
            client = oai.AsyncClient(api_key=api_key)
            stream = await client.chat.completions.create(
                model=model,
                messages=messages,
                stream=True,
                **kwargs,
            )
            async for chunk in stream:
                if chunk.choices and chunk.choices[0].delta.content:
                    yield StreamChunk.token(chunk.choices[0].delta.content)
            yield StreamChunk.done()
        except Exception as e:
            yield StreamChunk.error(f"OpenAI error: {e}")


# ── Anthropic Provider ──────────────────────────────────────────────


class AnthropicProvider(BaseProvider):
    name = "anthropic"

    async def discover(self) -> list[ModelInfo]:
        api_key = os.environ.get("ANTHROPIC_API_KEY", "")
        models = [
            ModelInfo(
                id="claude-sonnet-4-20250514",
                provider="anthropic",
                name="Claude Sonnet 4",
                description="Anthropic's balanced model (requires API key)" if not api_key else "Available via API key",
                capabilities=["text", "code", "reasoning"],
                context_length=200000,
                pricing="$3.00/$15.00 per 1M tokens",
                local=False,
                available=bool(api_key),
            ),
            ModelInfo(
                id="claude-haiku-3-5",
                provider="anthropic",
                name="Claude Haiku 3.5",
                description="Fast, affordable Anthropic model (requires API key)" if not api_key else "Available via API key",
                capabilities=["text", "code"],
                context_length=200000,
                pricing="$0.80/$4.00 per 1M tokens",
                local=False,
                available=bool(api_key),
            ),
        ]
        return models

    async def chat(
        self, model: str, messages: list[dict], **kwargs
    ) -> AsyncGenerator[StreamChunk, None]:
        api_key = os.environ.get("ANTHROPIC_API_KEY", "")
        if not api_key:
            yield StreamChunk.error("ANTHROPIC_API_KEY not configured")
            return
        try:
            import anthropic as ant
            client = ant.AsyncAnthropic(api_key=api_key)
            system_msg = None
            chat_msgs = messages
            if messages and messages[0].get("role") == "system":
                system_msg = messages[0]["content"]
                chat_msgs = messages[1:]
            async with client.messages.stream(
                model=model,
                max_tokens=4096,
                system=system_msg,
                messages=chat_msgs,
            ) as stream:
                async for chunk in stream:
                    if chunk.type == "content_block_delta" and chunk.delta.text:
                        yield StreamChunk.token(chunk.delta.text)
            yield StreamChunk.done()
        except Exception as e:
            yield StreamChunk.error(f"Anthropic error: {e}")


# ── Google Gemini Provider ──────────────────────────────────────────


class GeminiProvider(BaseProvider):
    name = "google"

    async def discover(self) -> list[ModelInfo]:
        api_key = os.environ.get("GOOGLE_API_KEY", "")
        models = [
            ModelInfo(
                id="gemini-2.5-flash",
                provider="google",
                name="Gemini 2.5 Flash",
                description="Google's fast model (requires API key)" if not api_key else "Available via API key",
                capabilities=["text", "vision", "code", "audio"],
                context_length=1000000,
                pricing="$0.15/$0.60 per 1M tokens",
                local=False,
                available=bool(api_key),
            ),
            ModelInfo(
                id="gemini-2.5-pro",
                provider="google",
                name="Gemini 2.5 Pro",
                description="Google's flagship model (requires API key)" if not api_key else "Available via API key",
                capabilities=["text", "vision", "code", "audio", "reasoning"],
                context_length=1000000,
                pricing="$1.25/$5.00 per 1M tokens",
                local=False,
                available=bool(api_key),
            ),
        ]
        return models

    async def chat(
        self, model: str, messages: list[dict], **kwargs
    ) -> AsyncGenerator[StreamChunk, None]:
        api_key = os.environ.get("GOOGLE_API_KEY", "")
        if not api_key:
            yield StreamChunk.error("GOOGLE_API_KEY not configured")
            return
        try:
            import google.generativeai as genai
            genai.configure(api_key=api_key)
            gen_model = genai.GenerativeModel(model)
            last = messages[-1]["content"] if messages else ""
            response = await gen_model.generate_content_async(last, stream=True)
            async for chunk in response:
                if chunk.text:
                    yield StreamChunk.token(chunk.text)
            yield StreamChunk.done()
        except Exception as e:
            yield StreamChunk.error(f"Google AI error: {e}")


# ── Helpers ─────────────────────────────────────────────────────────


def _fmt_size(size_bytes: int) -> str:
    if size_bytes == 0:
        return "?"
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if size_bytes < 1024:
            return f"{size_bytes:.1f}{unit}"
        size_bytes /= 1024
    return f"{size_bytes:.1f}PB"


# ── Register built-in providers ─────────────────────────────────────

registry.register(OllamaProvider())
registry.register(HuggingFaceProvider())
registry.register(OpenAIProvider())
registry.register(AnthropicProvider())
registry.register(GeminiProvider())
