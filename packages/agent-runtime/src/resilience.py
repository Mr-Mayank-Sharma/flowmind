from __future__ import annotations

import asyncio
import random
from collections.abc import Awaitable, Callable
from typing import Any, TypeVar

T = TypeVar("T")


def with_retry(
    max_retries: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 30.0,
    jitter: bool = True,
) -> Callable[[Callable[..., Awaitable[T]]], Callable[..., Awaitable[T]]]:
    def decorator(func: Callable[..., Awaitable[T]]) -> Callable[..., Awaitable[T]]:
        async def wrapper(*args: Any, **kwargs: Any) -> T:
            last_exception: Exception | None = None
            for attempt in range(max_retries + 1):
                try:
                    return await func(*args, **kwargs)
                except Exception as e:
                    last_exception = e
                    if attempt == max_retries:
                        raise

                    delay = min(base_delay * (2 ** attempt), max_delay)
                    if jitter:
                        delay *= 1.0 + random.random() * 0.5

                    await asyncio.sleep(delay)

            raise last_exception  # type: ignore[misc]

        return wrapper

    return decorator


class ToolExecutor:
    def __init__(self) -> None:
        self._registry: dict[str, Callable[..., Awaitable[str]]] = {}

    def register(self, name: str) -> Callable[..., Awaitable[str]]:
        def decorator(func: Callable[..., Awaitable[str]]) -> Callable[..., Awaitable[str]]:
            self._registry[name] = func
            return func
        return decorator

    async def execute(self, name: str, arguments: dict[str, Any]) -> str:
        if name not in self._registry:
            return f"Error: unknown tool '{name}'"

        try:
            result = await self._registry[name](**arguments)
            return str(result)
        except Exception as e:
            return f"Error executing tool '{name}': {e}"

    def list_tools(self) -> list[str]:
        return list(self._registry.keys())
