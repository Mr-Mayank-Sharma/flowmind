import { prisma } from "@flowmind/db"

export interface SkillDefinition {
  id: string
  name: string
  description: string
  triggerPattern?: string
  code: string
  version: number
  isActive: boolean
}

export interface SkillExecutionContext {
  userId: string
  input: string
  sessionId?: string
}

export interface SkillResult {
  output: string
  success: boolean
  durationMs: number
}

export class SkillEngine {
  async register(skill: SkillDefinition): Promise<void> {
    const existing = await prisma.skill.findFirst({
      where: { userId: skill.id.split("_")[0] ?? "", name: skill.name },
    })
    if (existing) {
      await prisma.skill.update({
        where: { id: existing.id },
        data: {
          description: skill.description,
          triggerPattern: skill.triggerPattern,
          code: skill.code,
          version: { increment: 1 },
          isActive: skill.isActive,
        },
      })
    } else {
      await prisma.skill.create({
        data: {
          userId: skill.id.split("_")[0] ?? "",
          name: skill.name,
          description: skill.description,
          triggerPattern: skill.triggerPattern,
          code: skill.code,
          isActive: skill.isActive,
        },
      })
    }
  }

  async unregister(skillId: string): Promise<void> {
    await prisma.skill.deleteMany({ where: { id: skillId } })
  }

  async execute(skillId: string, context: SkillExecutionContext): Promise<SkillResult> {
    const start = Date.now()
    const skill = await prisma.skill.findUnique({ where: { id: skillId } })
    if (!skill) throw new Error(`Skill ${skillId} not found`)
    if (!skill.isActive) throw new Error(`Skill ${skill.name} is disabled`)

    try {
      const fn = new Function("input", "userId", skill.code)
      const result = await fn(context.input, context.userId)
      const output = String(result ?? "")

      await prisma.skill.update({
        where: { id: skillId },
        data: { useCount: { increment: 1 }, successRate: 100 },
      })

      return { output, success: true, durationMs: Date.now() - start }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)

      await prisma.skill.update({
        where: { id: skillId },
        data: { useCount: { increment: 1 }, successRate: 0 },
      })

      return { output: errorMsg, success: false, durationMs: Date.now() - start }
    }
  }
}
