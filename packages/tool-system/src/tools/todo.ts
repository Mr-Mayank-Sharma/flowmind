import type { ToolInfo, ToolContext, ExecuteResult } from "../types"

interface TodoItem {
  content: string
  status: "pending" | "in_progress" | "completed" | "cancelled"
  priority: "high" | "medium" | "low"
}

const todos: TodoItem[] = []

export const TodoWriteToolInfo: ToolInfo = {
  id: "todowrite",
  init: () => ({
    id: "todowrite",
    description: "Create and manage task lists for multi-step operations. Tracks progress across the session.",
    parameters: {
      type: "object",
      properties: {
        todos: {
          type: "array",
          description: "List of tasks to track",
          items: {
            type: "object",
            properties: {
              content: { type: "string", description: "Brief description of the task" },
              status: { type: "string", enum: ["pending", "in_progress", "completed", "cancelled"] },
              priority: { type: "string", enum: ["high", "medium", "low"] },
            },
            required: ["content", "status", "priority"],
          },
        },
      },
      required: ["todos"],
    },
    async execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ExecuteResult> {
      const inputTodos = args.todos as TodoItem[]
      if (!inputTodos || !Array.isArray(inputTodos)) {
        throw new Error("todos must be an array")
      }

      todos.length = 0
      todos.push(...inputTodos)

      const active = todos.filter((t) => t.status === "in_progress")
      const pending = todos.filter((t) => t.status === "pending")
      const done = todos.filter((t) => t.status === "completed" || t.status === "cancelled")

      const output = [
        `## Tasks (${todos.length} total)`,
        "",
        ...(active.length ? [`### In Progress (${active.length})`, ...active.map((t) => `- ${t.content} [${t.priority}]`), ""] : []),
        ...(pending.length ? [`### Pending (${pending.length})`, ...pending.map((t) => `- ${t.content} [${t.priority}]`), ""] : []),
        ...(done.length ? [`### Done/Cancelled (${done.length})`, ...done.map((t) => `- ${t.content} [${t.priority}]`)] : []),
      ].filter(Boolean).join("\n")

      return {
        title: `Updated ${todos.length} tasks`,
        output,
        metadata: { total: todos.length, active: active.length, pending: pending.length, done: done.length },
      }
    },
  }),
}

export function createTodoWriteTool(): ToolInfo {
  return TodoWriteToolInfo
}
