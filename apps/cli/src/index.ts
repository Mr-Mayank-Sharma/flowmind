#!/usr/bin/env node

import { Command } from "commander"
import { registerAgentCommands } from "./commands/agent.js"
import { registerModelCommands } from "./commands/model.js"
import { registerPipelineCommands } from "./commands/pipeline.js"
import { registerMCPCommands } from "./commands/mcp.js"
import { registerContextCommands } from "./commands/context.js"
import { registerGovernanceCommands } from "./commands/governance.js"
import { registerChatCommands } from "./commands/chat.js"
import { registerSkillCommands } from "./commands/skill.js"
import { startInteractiveMode } from "./commands/interactive.js"
import { helpText } from "./utils/display.js"

const program = new Command()

program
  .name("flowmind")
  .description("FlowMind AI — Terminal AI Agent Framework")
  .version("0.1.0")

registerAgentCommands(program)
registerModelCommands(program)
registerPipelineCommands(program)
registerMCPCommands(program)
registerContextCommands(program)
registerGovernanceCommands(program)
registerChatCommands(program)
registerSkillCommands(program)

program
  .command("interactive")
  .alias("i")
  .alias("shell")
  .description("Start interactive REPL mode")
  .action(() => {
    startInteractiveMode()
  })

program
  .command("help")
  .description("Show help")
  .action(() => helpText())

program.parse(process.argv)

const args = process.argv.slice(2)
if (args.length === 0) {
  helpText()
}
