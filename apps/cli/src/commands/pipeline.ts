import { Command } from "commander"
import { getPipelines, addPipeline, deletePipeline } from "../store/index.js"
import { title, statusDot } from "../utils/display.js"
import chalk from "chalk"

export function registerPipelineCommands(program: Command): void {
  const pipeline = program.command("pipeline").description("Manage pipelines")

  pipeline
    .command("list")
    .description("List all pipelines")
    .action(() => {
      const pipelines = getPipelines()
      title(`Pipelines (${pipelines.length})`)
      if (pipelines.length === 0) {
        console.log(chalk.dim("  No pipelines yet."))
        return
      }
      for (const p of pipelines) {
        const dot = p.status === "ACTIVE" ? chalk.green("●") : p.status === "DRAFT" ? chalk.yellow("○") : chalk.dim("○")
        const lastRun = p.lastRunAt ? chalk.dim(p.lastRunAt) : chalk.dim("never run")
        console.log(`  ${dot} ${chalk.bold(p.name)}`)
        console.log(`    ${chalk.dim(p.description)}`)
        console.log(`    ${chalk.dim(`${p.nodeCount} nodes · ${p.status} · last: ${lastRun}`)}`)
        console.log()
      }
    })

  pipeline
    .command("create")
    .description("Create a new pipeline")
    .requiredOption("-n, --name <name>", "Pipeline name")
    .option("-d, --description <desc>", "Description", "New pipeline")
    .action((options) => {
      addPipeline({
        id: "p" + Date.now(),
        name: options.name,
        description: options.description,
        status: "DRAFT",
        lastRunAt: null,
        nodeCount: 0,
      })
      console.log(chalk.green(`  ✓ Pipeline "${options.name}" created`))
    })

  pipeline
    .command("delete")
    .description("Delete a pipeline")
    .requiredOption("-i, --id <id>", "Pipeline ID")
    .action((options) => {
      deletePipeline(options.id)
      console.log(chalk.green(`  ✓ Pipeline ${options.id} deleted`))
    })

  pipeline
    .command("run")
    .description("Run a pipeline (simulated)")
    .requiredOption("-i, --id <id>", "Pipeline ID")
    .action((options) => {
      console.log(chalk.cyan(`  ▶ Running pipeline ${options.id}...`))
      setTimeout(() => {
        console.log(chalk.green(`  ✓ Pipeline ${options.id} completed successfully`))
      }, 1500)
    })
}
