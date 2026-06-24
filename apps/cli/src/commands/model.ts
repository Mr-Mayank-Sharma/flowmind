import { Command } from "commander"
import { getModels, updateModelApiKey } from "../store/index.js"
import { title, keyValue, badge } from "../utils/display.js"
import chalk from "chalk"

export function registerModelCommands(program: Command): void {
  const model = program.command("model").description("Browse and configure models")

  model
    .command("list")
    .description("List all model providers and their models")
    .action(() => {
      const providers = getModels()
      title(`Model Hub (${providers.length} providers)`)

      for (const p of providers) {
        console.log(`  ${p.icon} ${chalk.bold(p.name)} ${p.apiKeyConfigured ? chalk.green("✓") : chalk.dim("no key")}`)
        if (p.baseUrl) console.log(`    ${chalk.dim(p.baseUrl)}`)
        for (const m of p.models) {
          const local = m.isLocal ? chalk.dim(" [local]") : ""
          const pricing = m.inputPrice === 0 ? chalk.green(" free") : chalk.yellow(` $${m.inputPrice}/${m.outputPrice}M`)
          console.log(`    ${chalk.cyan("└")} ${chalk.white(m.name)}${local}${pricing}  ${chalk.dim(m.capabilities.join(", "))}`)
        }
        console.log()
      }
    })

  model
    .command("configure")
    .description("Configure API key for a provider")
    .requiredOption("-p, --provider <id>", "Provider ID (openai, anthropic, ollama, etc.)")
    .option("-k, --key <key>", "API key")
    .action((options) => {
      const providers = getModels()
      const provider = providers.find(p => p.id === options.provider)
      if (!provider) {
        console.log(chalk.red(`  ✗ Provider "${options.provider}" not found. Available: ${providers.map(p => p.id).join(", ")}`))
        return
      }
      updateModelApiKey(options.provider, options.key || "configured")
      console.log(chalk.green(`  ✓ API key configured for ${provider.name}`))
    })

  model
    .command("show")
    .description("Show provider details")
    .requiredOption("-p, --provider <id>", "Provider ID")
    .action((options) => {
      const providers = getModels()
      const p = providers.find(p => p.id === options.provider)
      if (!p) {
        console.log(chalk.red(`  ✗ Provider "${options.provider}" not found`))
        return
      }
      title(`${p.icon} ${p.name}`)
      console.log(`  ${keyValue("ID", p.id)}`)
      console.log(`  ${keyValue("API Key", p.apiKeyConfigured ? chalk.green("Configured") : chalk.dim("Not configured"))}`)
      if (p.baseUrl) console.log(`  ${keyValue("Base URL", p.baseUrl)}`)
      console.log()
      for (const m of p.models) {
        console.log(`  ${chalk.bold(m.name)}`)
        console.log(`    ${keyValue("Context", `${(m.contextWindow / 1000).toFixed(0)}K tokens`)}`)
        console.log(`    ${keyValue("Pricing", m.inputPrice === 0 ? "Free" : `$${m.inputPrice}/M input, $${m.outputPrice}/M output`)}`)
        console.log(`    ${keyValue("Capabilities", m.capabilities.join(", "))}`)
        console.log()
      }
    })
}
