import { Command } from "commander"
import { createInterface } from "readline"
import { getAgents, getChatSessions, createChatSession, updateChatSession, deleteChatSession } from "../store/index.js"
import { chatWithModel, generateAgentResponse } from "../utils/ai.js"
import { helpText } from "../utils/display.js"
import chalk from "chalk"
import type { ChatMessage, ChatSession } from "../types.js"

function createReadline() {
  return createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "",
  })
}

export function registerChatCommands(program: Command): void {
  const chat = program.command("chat").description("Chat with an AI agent")

  chat
    .command("start")
    .description("Start an interactive chat session")
    .option("-a, --agent <id>", "Agent ID to chat with")
    .option("-s, --session <id>", "Resume existing session")
    .action(async (options) => {
      const agents = getAgents()
      let currentAgent = agents[0]

      if (options.agent) {
        currentAgent = agents.find(a => a.id === options.agent) || currentAgent
      }

      let session: ChatSession
      if (options.session) {
        const existing = getChatSessions().find(s => s.id === options.session)
        if (existing) {
          session = existing
        } else {
          console.log(chalk.yellow(`  ! Session ${options.session} not found, starting new`))
          session = createNewSession(currentAgent)
        }
      } else {
        session = createNewSession(currentAgent)
      }

      console.log()
      console.log(chalk.bold(`  Chat with ${currentAgent.name} (${currentAgent.role})`))
      console.log(chalk.dim(`  Session: ${session.id} · Type /exit to quit, /help for commands`))
      console.log()

      for (const msg of session.messages) {
        const prefix = msg.role === "user" ? chalk.cyan("You:") : chalk.green(`${currentAgent.name}:`)
        console.log(`  ${prefix} ${msg.content}`)
        console.log()
      }

      const rl = createReadline()
      rl.prompt()

      rl.on("line", async (line) => {
        const input = line.trim()
        if (!input) { rl.prompt(); return }

        if (input === "/exit") {
          rl.close()
          return
        }

        if (input === "/help") {
          console.log(chalk.dim("  /exit     Exit chat"))
          console.log(chalk.dim("  /clear    Clear messages"))
          console.log(chalk.dim("  /agent    Switch agent"))
          console.log(chalk.dim("  /save     Save session"))
          console.log()
          rl.prompt()
          return
        }

        if (input === "/clear") {
          session.messages = []
          updateChatSession(session.id, { messages: [] })
          console.log(chalk.green("  ✓ Cleared"))
          console.log()
          rl.prompt()
          return
        }

        const userMsg: ChatMessage = {
          id: "m" + Date.now(),
          sessionId: session.id,
          role: "user",
          content: input,
          timestamp: new Date().toISOString(),
        }
        session.messages.push(userMsg)

        console.log(`  ${chalk.cyan("You:")} ${input}`)
        console.log()

        const response = await chatWithModel(
          session.messages.map(m => ({ role: m.role, content: m.content })),
          currentAgent.model
        )

        const assistantMsg: ChatMessage = {
          id: "m" + Date.now() + 1,
          sessionId: session.id,
          role: "assistant",
          content: response.content,
          timestamp: new Date().toISOString(),
        }
        session.messages.push(assistantMsg)
        session.updatedAt = new Date().toISOString()
        updateChatSession(session.id, { messages: session.messages, updatedAt: session.updatedAt })

        console.log(`  ${chalk.green(`${currentAgent.name}:`)} ${response.content}`)
        console.log()
        rl.prompt()
      })

      rl.on("close", () => {
        console.log(chalk.dim("\n  Chat ended. Session saved."))
        process.exit(0)
      })
    })

  chat
    .command("sessions")
    .description("List chat sessions")
    .action(() => {
      const sessions = getChatSessions()
      if (sessions.length === 0) {
        console.log(chalk.dim("  No chat sessions."))
        return
      }
      for (const s of sessions) {
        const count = s.messages.length
        const last = s.messages[count - 1]
        console.log(`  ${chalk.bold(s.name)} ${chalk.dim(`(${s.id})`)}`)
        console.log(`    ${chalk.dim(`${count} messages · ${last ? last.timestamp.slice(0, 10) : ""}`)}`)
        console.log()
      }
    })

  chat
    .command("delete")
    .description("Delete a chat session")
    .requiredOption("-i, --id <id>", "Session ID")
    .action((options) => {
      deleteChatSession(options.id)
      console.log(chalk.green(`  ✓ Session ${options.id} deleted`))
    })
}

function createNewSession(agent: any): ChatSession {
  const session: ChatSession = {
    id: "chat_" + Date.now(),
    name: `Chat with ${agent.name}`,
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  createChatSession(session)
  return session
}
