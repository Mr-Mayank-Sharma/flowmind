import ivm from "isolated-vm"
import { prisma } from "@flowmind/db"

const SKILL_TIMEOUT_MS = 5000
const SKILL_MEMORY_MB = 128

export interface SkillDefinition {
  id: string
  userId: string
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

function runSandboxed(code: string, input: string, userId: string): Promise<string> {
  const isolate = new ivm.Isolate({ memoryLimit: SKILL_MEMORY_MB })
  const context = isolate.createContextSync()

  const jail = context.global
  jail.setSync("input", new ivm.ExternalCopy(input).copyInto())
  jail.setSync("userId", new ivm.ExternalCopy(userId).copyInto())

  try {
    const script = isolate.compileScriptSync(`(function(){ ${code} })(input, userId)`)
    const result = script.runSync(context, { timeout: SKILL_TIMEOUT_MS })
    context.release()
    isolate.dispose()
    return Promise.resolve(String(result ?? ""))
  } catch (err) {
    context.release()
    isolate.dispose()
    const message = err instanceof Error ? err.message : String(err)
    return Promise.reject(new Error(message))
  }
}

export class SkillEngine {
  async register(skill: SkillDefinition): Promise<void> {
    const existing = await prisma.skill.findFirst({
      where: { userId: skill.userId, name: skill.name },
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
          userId: skill.userId,
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
      const output = await runSandboxed(skill.code, context.input, context.userId)

      await prisma.skill.update({
        where: { id: skillId },
        data: {
          useCount: { increment: 1 },
          successCount: { increment: 1 },
          successRate: undefined,
        },
      })

      await this.recalculateSuccessRate(skillId)

      return { output, success: true, durationMs: Date.now() - start }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)

      await prisma.skill.update({
        where: { id: skillId },
        data: {
          useCount: { increment: 1 },
          successRate: undefined,
        },
      })

      await this.recalculateSuccessRate(skillId)

      return { output: errorMsg, success: false, durationMs: Date.now() - start }
    }
  }

  private async recalculateSuccessRate(skillId: string): Promise<void> {
    const skill = await prisma.skill.findUnique({
      where: { id: skillId },
      select: { useCount: true, successCount: true },
    })
    if (!skill || skill.useCount === 0) return
    const rate = Math.round((skill.successCount / skill.useCount) * 100)
    await prisma.skill.update({
      where: { id: skillId },
      data: { successRate: rate },
    })
  }
}
