from __future__ import annotations

import asyncio
import json
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
MAX_AGENT_ITERATIONS = 10

SYSTEM_PROMPT = (
    "You are FlowMind Agent, an AI assistant that helps users build websites, apps, "
    "and automation workflows. You can use tools to read and write files, run commands, "
    "search the web, and more."
)

TOOL_CALLING_PROMPT = """
You have access to these tools:

- write(filePath: str, content: str) — Create or overwrite a file
- read(filePath: str) — Read the contents of a file
- edit(filePath: str, oldString: str, newString: str) — Replace text in a file
- bash(command: str, timeout: int, workdir: str) — Execute a shell command
- grep(pattern: str, path: str) — Search files for a pattern
- glob(pattern: str) — Find files matching a pattern
- websearch(query: str) — Search the web for information
- webfetch(url: str) — Fetch content from a URL

To use a tool, output EXACTLY this format (with the actual arguments):

<tool name="write">
filePath: /absolute/path/to/file.html
content: <!DOCTYPE html>
<html>...
</tool>

After the tool executes, you will see its result. You can use multiple tools in sequence.
When you are done, respond naturally to the user with a summary of what was done.
"""

TOOLS_DESCRIPTION = (
    "Available tools:\n"
    "- write(filePath, content): Create or overwrite a file with new content\n"
    "- read(filePath): Read the contents of a file\n"
    "- edit(filePath, oldString, newString): Make an exact string replacement in a file\n"
    "- bash(command, timeout, workdir): Execute shell commands\n"
    "- grep(pattern, path, include): Search file contents using regex\n"
    "- glob(pattern): Find files by name patterns\n"
    "- websearch(query): Search the web\n"
    "- webfetch(url): Fetch content from a URL\n"
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

    async def _stream_chat(
        self, messages: list[dict], system_prompt: str = ""
    ) -> AsyncGenerator[StreamChunk, None]:
        full_messages = []
        if system_prompt:
            full_messages.append({"role": "system", "content": system_prompt})
        full_messages.extend(messages)

        await self.llm_router.discover_models()
        config = {"estimated_tokens": sum(len(m.get("content", "").split()) for m in full_messages), "prefer_local": True}
        provider_name, model_name = self.llm_router.select_provider(config)
        async for chunk in self.llm_router.stream_chat(provider_name, model_name, full_messages):
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
        parts.append(TOOL_CALLING_PROMPT)
        return "\n\n".join(parts)

    # ── Tool Call Parsing ──────────────────────────────────────────────

    TOOL_CALL_RE = re.compile(
        r'<tool\s+name=["\'](\w+)["\']>\s*\n(.*?)\n</tool>',
        re.DOTALL,
    )

    def _parse_tool_calls(self, text: str) -> list[dict]:
        calls: list[dict] = []
        for match in self.TOOL_CALL_RE.finditer(text):
            name = match.group(1)
            body = match.group(2).strip()
            args: dict[str, Any] = {}
            for line in body.split("\n"):
                line = line.strip()
                if ":" in line:
                    key, _, val = line.partition(":")
                    args[key.strip()] = val.strip()
            if name and args:
                calls.append({"name": name, "args": args})
        return calls

    def _extract_json(self, text: str) -> dict | None:
        text = text.strip()
        start = text.find("{")
        end = text.rfind("}")
        if start == -1 or end == -1:
            return None
        try:
            return json.loads(text[start : end + 1])
        except json.JSONDecodeError:
            return None

    def _extract_file_blocks(self, text: str) -> list[tuple[str, str]]:
        blocks: list[tuple[str, str]] = []
        pattern = r'(?:File|file):?\s*(\S+)\s*\n```(?:\w+)?\n(.*?)```'
        for m in re.finditer(pattern, text, re.DOTALL):
            filepath = m.group(1).strip()
            content = m.group(2).strip()
            if filepath and content:
                blocks.append((filepath, content))
        if not blocks:
            alt_pattern = r'```(?:\w+)?\n(.*?)```'
            matches = re.findall(alt_pattern, text, re.DOTALL)
            for content in matches[:5]:
                blocks.append(("output.txt", content.strip()))
        return blocks

    # ── Fallback Portfolio Template ────────────────────────────────────

    @staticmethod
    def _portfolio_fallback(user_message: str) -> list[tuple[str, str]]:
        name_match = re.search(r"(?:for|of|called|named)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)", user_message)
        person_name = name_match.group(1) if name_match else "Alex Johnson"

        html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{person_name} &mdash; Software Developer</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <header>
    <nav>
      <h1>{person_name}</h1>
      <ul>
        <li><a href="#about">About</a></li>
        <li><a href="#projects">Projects</a></li>
        <li><a href="#skills">Skills</a></li>
        <li><a href="#contact">Contact</a></li>
      </ul>
    </nav>
  </header>

  <section id="hero">
    <h2>Hi, I&rsquo;m {person_name}</h2>
    <p>Full-stack software developer building robust, scalable applications.</p>
  </section>

  <section id="about">
    <h2>About Me</h2>
    <p>
      I am a passionate software developer with experience building modern web applications,
      APIs, and distributed systems. I love turning complex problems into simple, elegant solutions.
    </p>
  </section>

  <section id="projects">
    <h2>Projects</h2>
    <div class="project-grid">
      <div class="project-card">
        <h3>Project One</h3>
        <p>A full-stack web application built with React and Node.js.</p>
      </div>
      <div class="project-card">
        <h3>Project Two</h3>
        <p>An open-source CLI tool for automating developer workflows.</p>
      </div>
      <div class="project-card">
        <h3>Project Three</h3>
        <p>A real-time data pipeline processing millions of events per day.</p>
      </div>
    </div>
  </section>

  <section id="skills">
    <h2>Skills</h2>
    <ul class="skills-list">
      <li>TypeScript / JavaScript</li>
      <li>Python</li>
      <li>React &amp; Next.js</li>
      <li>Node.js &amp; Fastify</li>
      <li>PostgreSQL &amp; Prisma</li>
      <li>Docker &amp; Kubernetes</li>
    </ul>
  </section>

  <section id="contact">
    <h2>Contact</h2>
    <p>Email: <a href="mailto:{person_name.lower().replace(' ', '.')}@example.com">{person_name.lower().replace(' ', '.')}@example.com</a></p>
    <p>GitHub: <a href="https://github.com/{person_name.lower().replace(' ', '')}">github.com/{person_name.lower().replace(' ', '')}</a></p>
  </section>

  <footer>
    <p>&copy; 2026 {person_name}. All rights reserved.</p>
  </footer>
</body>
</html>"""

        css = """/* ===== Reset & Base ===== */
*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
html { scroll-behavior: smooth; }
body { font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a2e; background: #f8f9fa; }

/* ===== Header / Nav ===== */
header { background: #1a1a2e; color: #fff; padding: 1rem 2rem; position: sticky; top: 0; z-index: 10; }
nav { max-width: 1000px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; }
nav h1 { font-size: 1.4rem; }
nav ul { list-style: none; display: flex; gap: 1.5rem; }
nav a { color: #e0e0e0; text-decoration: none; transition: color .2s; }
nav a:hover { color: #fff; }

/* ===== Sections ===== */
section { max-width: 900px; margin: 0 auto; padding: 4rem 2rem; }
#hero { text-align: center; padding-top: 6rem; padding-bottom: 4rem; }
#hero h2 { font-size: 2.5rem; margin-bottom: .75rem; }
#hero p { font-size: 1.15rem; color: #555; }
h2 { font-size: 1.75rem; margin-bottom: 1.5rem; color: #1a1a2e; }

/* ===== Projects ===== */
.project-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.25rem; }
.project-card { background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 1.5rem; transition: box-shadow .2s; }
.project-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,.08); }
.project-card h3 { margin-bottom: .5rem; }

/* ===== Skills ===== */
.skills-list { display: flex; flex-wrap: wrap; gap: .75rem; list-style: none; }
.skills-list li { background: #e8edf5; padding: .5rem 1rem; border-radius: 20px; font-size: .9rem; }

/* ===== Contact & Footer ===== */
#contact a { color: #2563eb; text-decoration: none; }
footer { text-align: center; padding: 2rem; color: #777; font-size: .85rem; border-top: 1px solid #e0e0e0; margin-top: 2rem; }"""

        return [
            ("/home/mayanksharma/Desktop/portfolio/index.html", html),
            ("/home/mayanksharma/Desktop/portfolio/style.css", css),
        ]

    # ── Tool Execution Bridge ──────────────────────────────────────────

    async def _execute_via_api(self, tool_id: str, args: dict) -> str:
        try:
            async with httpx.AsyncClient(timeout=60) as client:
                r = await client.post(
                    f"{API_URL}/api/internal/execute-tool",
                    json={"toolId": tool_id, "args": args},
                )
                if r.is_success:
                    data = r.json()
                    return data.get("output", "ok")
                return f"Error: {r.text[:300]}"
        except Exception as e:
            return f"Error: {e}"

    # ── Agent Loop ─────────────────────────────────────────────────────

    async def _agent_loop(
        self, user_message: str, context_blocks: list[dict]
    ) -> tuple[str, list[tuple[str, str]]]:
        conversations: list[dict] = []
        all_tool_results: list[tuple[str, str]] = []
        final_text = ""
        used_plan = False

        if context_blocks:
            ctx_text = "\n".join(
                f"[{b.get('source', 'unknown')}]: {b.get('content', '')}"
                for b in context_blocks
            )
            if ctx_text:
                conversations.append({"role": "system", "content": f"Relevant context:\n{ctx_text}"})

        if self._history:
            history_text = "\n".join(
                f"{m.role}: {m.content}" for m in self._history[-10:]
            )
            conversations.append({"role": "system", "content": f"Conversation history:\n{history_text}"})

        conversations.append({"role": "user", "content": user_message})

        for iteration in range(MAX_AGENT_ITERATIONS):
            system = SYSTEM_PROMPT + "\n\n" + TOOL_CALLING_PROMPT

            response = ""
            async for chunk in self._stream_chat(conversations, system_prompt=system):
                if chunk.type == "token":
                    response += chunk.content
                if chunk.type == "error":
                    break

            tool_calls = self._parse_tool_calls(response)

            if not tool_calls:
                final_text = response
                break

            conversations.append({"role": "assistant", "content": response})

            for tc in tool_calls:
                name = tc["name"]
                args = tc["args"]
                result = await self._execute_via_api(name, args)
                all_tool_results.append((name, result))
                conversations.append({
                    "role": "system",
                    "content": f"Tool [{name}] result:\n{result[:500]}",
                })
                used_plan = True

        if not final_text:
            final_text = response if "response" in dir() else "I completed the task."

        if not used_plan:
            execution_keywords = [
                "make", "create", "build", "generate", "scaffold", "write a",
                "develop", "implement", "portfolio", "website", "landing page", "app",
            ]
            combined = f"{final_text} {user_message}".lower()
            if any(kw in combined for kw in execution_keywords):
                plan_chunks = await self._plan_and_execute_fallback(user_message)
                for pc in plan_chunks:
                    if pc.type == "tool_result":
                        all_tool_results.append((pc.content, pc.metadata.get("result", "")))

        return final_text, all_tool_results

    async def _plan_and_execute_fallback(self, user_message: str) -> list[StreamChunk]:
        chunks: list[StreamChunk] = []

        plan_prompt = (
            f"Task: {user_message}\n\n"
            f"{TOOLS_DESCRIPTION}\n\n"
            "Create a plan as a JSON object with a 'steps' array. "
            "Each step has: 'tool' (one of: write, read, edit, bash, grep, glob, websearch, webfetch) "
            "and 'args' (object with the tool's parameter names as keys).\n\n"
            "IMPORTANT: For the write tool, filePath MUST be an absolute path like /home/user/project/file.js. "
            "Always include complete file contents in the 'content' argument.\n\n"
            "Example:\n"
            '{"steps": [{"tool": "write", "args": {"filePath": "/home/user/project/index.html", "content": "<html>...</html>"}}, {"tool": "bash", "args": {"command": "echo done", "workdir": "/home/user/project"}}]}\n\n'
            "Respond with ONLY the JSON object, no other text."
        )

        plan_text = ""
        async for chunk in self._call_llm(plan_prompt):
            if chunk.type == "token":
                plan_text += chunk.content

        plan = self._extract_json(plan_text)
        if plan and isinstance(plan.get("steps"), list) and len(plan["steps"]) > 0:
            chunks.append(StreamChunk.tool_call("plan", {"step_count": len(plan["steps"])}))
            for i, step in enumerate(plan["steps"]):
                tool_name = step.get("tool", "")
                args = step.get("args", {})
                if not tool_name:
                    continue
                result = await self._execute_via_api(tool_name, args)
                chunks.append(StreamChunk.tool_result(f"{tool_name}_{i}", result))
            return chunks

        file_blocks = self._extract_file_blocks(plan_text)
        if file_blocks:
            chunks.append(StreamChunk.tool_call("plan", {"source": "markdown_blocks"}))
            for filepath, content in file_blocks:
                if not filepath.startswith("/"):
                    filepath = f"/home/mayanksharma/Desktop/portfolio/{filepath}"
                result = await self._execute_via_api("write", {"filePath": filepath, "content": content})
                chunks.append(StreamChunk.tool_result(f"write_{os.path.basename(filepath)}", result))
            return chunks

        file_pairs = self._portfolio_fallback(user_message)
        chunks.append(StreamChunk.tool_call("plan", {"source": "fallback_template"}))
        for filepath, content in file_pairs:
            result = await self._execute_via_api("write", {"filePath": filepath, "content": content})
            name = os.path.basename(filepath)
            chunks.append(StreamChunk.tool_result(f"write_{name}", result))
        return chunks

    # ── Old-style tool triggers (pipeline + skill creation) ────────────

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

    # ── Public API ─────────────────────────────────────────────────────

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
        context_blocks = context or []

        self._history.append(Memory(user_id=self.user_id, content=message, role="user"))

        final_text, tool_results = await self._agent_loop(message, context_blocks)

        if tool_results:
            lines = []
            for name, result in tool_results:
                summary = result[:200] + "..." if len(result) > 200 else result
                lines.append(f"- {name}: {summary}")
            final_text += "\n\n--- Tool Results ---\n" + "\n".join(lines)

        self._history.append(
            Memory(
                user_id=self.user_id,
                content=final_text,
                role="assistant",
            )
        )

        return final_text
