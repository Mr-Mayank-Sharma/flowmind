from __future__ import annotations

import asyncio
from datetime import datetime

from src.models import Skill


class SkillEngine:
    def __init__(self) -> None:
        self._skills: dict[str, Skill] = {}

    async def evaluate_skill_creation(self, task_info: dict[str, str]) -> bool:
        await asyncio.sleep(0.05)
        keywords = task_info.get("description", "") + " " + task_info.get("objective", "")
        trigger_words = {"automate", "repeated", "workflow", "pipeline", "batch", "schedule"}
        return any(w in keywords.lower() for w in trigger_words)

    async def create_skill(self, name: str, description: str, code: str) -> Skill:
        skill = Skill(name=name, description=description, code=code, created_at=datetime.utcnow())
        self._skills[skill.id] = skill
        return skill

    async def get_skill(self, skill_id: str) -> Skill | None:
        return self._skills.get(skill_id)

    async def list_skills(self, enabled_only: bool = True) -> list[Skill]:
        skills = list(self._skills.values())
        if enabled_only:
            skills = [s for s in skills if s.enabled]
        return skills

    async def delete_skill(self, skill_id: str) -> bool:
        return self._skills.pop(skill_id, None) is not None
