import { Command } from "commander"
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync } from "fs"
import { homedir } from "os"
import { join, resolve } from "path"
import chalk from "chalk"
import { execSync } from "child_process"

const SKILLS_DIR = join(homedir(), ".flowmind", "skills")

function ensureSkillsDir(): void {
  if (!existsSync(SKILLS_DIR)) {
    mkdirSync(SKILLS_DIR, { recursive: true })
  }
}

function getGitAuthor(): string {
  try {
    return execSync("git config user.name", { encoding: "utf-8" }).trim()
  } catch {
    return "unknown"
  }
}

function readManifest(skillDir: string): Record<string, unknown> | null {
  const manifestPath = join(skillDir, "skill.json")
  if (!existsSync(manifestPath)) return null
  try {
    return JSON.parse(readFileSync(manifestPath, "utf-8"))
  } catch {
    return null
  }
}

function listInstalledSkills(): Array<{ name: string; dir: string; manifest: Record<string, unknown> }> {
  ensureSkillsDir()
  const entries = readdirSync(SKILLS_DIR, { withFileTypes: true })
  const skills: Array<{ name: string; dir: string; manifest: Record<string, unknown> }> = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const dir = join(SKILLS_DIR, entry.name)
    const manifest = readManifest(dir)
    if (manifest) {
      skills.push({ name: entry.name, dir, manifest })
    }
  }
  return skills
}

export function registerSkillCommands(program: Command): void {
  const skill = program.command("skill").description("Manage skills")

  skill
    .command("create")
    .description("Create a new skill from template")
    .argument("<name>", "Skill name (kebab-case)")
    .option("-a, --author <author>", "Author name")
    .action((name: string, options: { author?: string }) => {
      const skillDir = resolve(name)
      if (existsSync(skillDir)) {
        console.log(chalk.red(`  ✗ Directory "${name}" already exists`))
        return
      }

      const author = options.author || getGitAuthor()

      const manifest = {
        name,
        version: "0.1.0",
        description: `A FlowMind skill: ${name}`,
        author,
        runtime: "sandboxed-js",
        entryPoint: "index.js",
        inputs: [{ name: "input", type: "string", required: true, description: "Input text" }],
        outputs: [{ name: "result", type: "string", description: "Output result" }],
        permissions: [],
        dependencies: [],
        compatibility: ">=0.1.0",
        tags: [],
      }

      const entryPoint = `// ${name} skill entry point
function execute(input, context) {
  return "Processed: " + input;
}

module.exports = { execute };
`

      const readme = `# ${name}

${manifest.description}

## Usage

\`\`\`bash
flowmind skill run ${name} --input '{"input": "hello"}'
\`\`\`
`

      const testFile = `const { execute } = require("./index.js");
const result = execute("hello", { userId: "test" });
console.assert(typeof result === "string", "Result should be a string");
console.log("All tests passed:", result);
`

      mkdirSync(skillDir, { recursive: true })
      writeFileSync(join(skillDir, "skill.json"), JSON.stringify(manifest, null, 2))
      writeFileSync(join(skillDir, "index.js"), entryPoint)
      writeFileSync(join(skillDir, "README.md"), readme)
      writeFileSync(join(skillDir, "test.js"), testFile)

      console.log(chalk.green(`  ✓ Skill "${name}" created in ${skillDir}`))
      console.log(chalk.dim("    Files: skill.json, index.js, README.md, test.js"))
    })

  skill
    .command("list")
    .description("List installed skills")
    .action(() => {
      const skills = listInstalledSkills()
      if (skills.length === 0) {
        console.log(chalk.dim("  No skills installed."))
        console.log(chalk.dim("  Install one: flowmind skill install <name>"))
        return
      }
      console.log(chalk.bold(`  Installed Skills (${skills.length})`))
      console.log()
      for (const s of skills) {
        const m = s.manifest
        const version = (m.version as string) || "?"
        const desc = (m.description as string) || ""
        const author = (m.author as string) || ""
        console.log(`  ${chalk.green("●")} ${chalk.bold(m.name as string)} ${chalk.dim(`v${version}`)}`)
        console.log(`    ${chalk.dim(desc)}`)
        console.log(`    ${chalk.dim(`by ${author}`)}`)
        console.log()
      }
    })

  skill
    .command("install")
    .description("Install a skill from the marketplace")
    .argument("<name>", "Skill name to install")
    .option("--version <version>", "Specific version to install")
    .action(async (name: string, options: { version?: string }) => {
      ensureSkillsDir()
      const skillDir = join(SKILLS_DIR, name)

      if (existsSync(skillDir)) {
        console.log(chalk.yellow(`  ⚠ Skill "${name}" is already installed. Use "flowmind skill update ${name}" to update.`))
        return
      }

      console.log(chalk.cyan(`  ↓ Installing skill "${name}"...`))

      try {
        const API_URL = process.env.FLOWMIND_API_URL || "http://localhost:3001"
        const versionParam = options.version ? `&version=${encodeURIComponent(options.version)}` : ""
        const res = await fetch(`${API_URL}/trpc/skills.getById?input=${JSON.stringify({ name })}${versionParam}`, {
          signal: AbortSignal.timeout(10000),
        })

        if (!res.ok) {
          console.log(chalk.red(`  ✗ Skill "${name}" not found in marketplace`))
          return
        }

        const json = await res.json() as { result?: { data?: { manifest: Record<string, unknown>; code: string } } }
        const data = json.result?.data
        if (!data) {
          console.log(chalk.red(`  ✗ Failed to fetch skill "${name}"`))
          return
        }

        mkdirSync(skillDir, { recursive: true })
        writeFileSync(join(skillDir, "skill.json"), JSON.stringify(data.manifest, null, 2))
        writeFileSync(join(skillDir, "index.js"), data.code)

        console.log(chalk.green(`  ✓ Skill "${name}" installed to ${skillDir}`))
      } catch {
        console.log(chalk.red(`  ✗ Failed to connect to marketplace`))
        console.log(chalk.dim("    Make sure the API server is running"))
      }
    })

  skill
    .command("publish")
    .description("Publish current skill to the marketplace")
    .option("-d, --dir <dir>", "Skill directory", ".")
    .action(async (options: { dir: string }) => {
      const skillDir = resolve(options.dir)
      const manifest = readManifest(skillDir)

      if (!manifest) {
        console.log(chalk.red(`  ✗ No skill.json found in ${skillDir}`))
        return
      }

      const entryPath = join(skillDir, manifest.entryPoint as string)
      if (!existsSync(entryPath)) {
        console.log(chalk.red(`  ✗ Entry point "${manifest.entryPoint}" not found`))
        return
      }

      console.log(chalk.cyan(`  ↑ Publishing skill "${manifest.name}" v${manifest.version}...`))

      try {
        const code = readFileSync(entryPath, "utf-8")
        const API_URL = process.env.FLOWMIND_API_URL || "http://localhost:3001"
        const res = await fetch(`${API_URL}/trpc/skills.publish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ manifest, code }),
          signal: AbortSignal.timeout(15000),
        })

        if (!res.ok) {
          const error = await res.text()
          console.log(chalk.red(`  ✗ Publish failed: ${error}`))
          return
        }

        console.log(chalk.green(`  ✓ Skill "${manifest.name}" published to marketplace`))
        console.log(chalk.dim(`    URL: http://localhost:3000/marketplace/skills/${manifest.name}`))
      } catch {
        console.log(chalk.red(`  ✗ Failed to connect to marketplace`))
      }
    })

  skill
    .command("run")
    .description("Run an installed skill")
    .argument("<name>", "Skill name")
    .option("-i, --input <json>", "Input JSON string", "{}")
    .action(async (name: string, options: { input: string }) => {
      const skillDir = join(SKILLS_DIR, name)
      const manifest = readManifest(skillDir)

      if (!manifest) {
        console.log(chalk.red(`  ✗ Skill "${name}" not installed`))
        return
      }

      let input: Record<string, unknown>
      try {
        input = JSON.parse(options.input)
      } catch {
        console.log(chalk.red(`  ✗ Invalid JSON input`))
        return
      }

      console.log(chalk.cyan(`  ▶ Running skill "${name}"...`))

      try {
        const API_URL = process.env.FLOWMIND_API_URL || "http://localhost:3001"
        const res = await fetch(`${API_URL}/trpc/skills.run`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, inputs: input }),
          signal: AbortSignal.timeout(30000),
        })

        if (!res.ok) {
          console.log(chalk.red(`  ✗ Failed to run skill`))
          return
        }

        const json = await res.json() as { result?: { data?: { output: string; success: boolean; durationMs: number } } }
        const data = json.result?.data
        if (data) {
          if (data.success) {
            console.log(chalk.green(`  ✓ Completed in ${data.durationMs}ms`))
            console.log(data.output)
          } else {
            console.log(chalk.red(`  ✗ Failed: ${data.output}`))
          }
        }
      } catch {
        console.log(chalk.red(`  ✗ Failed to connect to API`))
      }
    })

  skill
    .command("update")
    .description("Update an installed skill to the latest version")
    .argument("<name>", "Skill name")
    .action(async (name: string) => {
      const skillDir = join(SKILLS_DIR, name)
      const manifest = readManifest(skillDir)

      if (!manifest) {
        console.log(chalk.red(`  ✗ Skill "${name}" not installed`))
        return
      }

      console.log(chalk.cyan(`  ↑ Checking for updates to "${name}"...`))

      try {
        const API_URL = process.env.FLOWMIND_API_URL || "http://localhost:3001"
        const res = await fetch(`${API_URL}/trpc/skills.getById?input=${JSON.stringify({ name })}`, {
          signal: AbortSignal.timeout(10000),
        })

        if (!res.ok) {
          console.log(chalk.red(`  ✗ Skill "${name}" not found in marketplace`))
          return
        }

        const json = await res.json() as { result?: { data?: { manifest: Record<string, unknown>; code: string } } }
        const data = json.result?.data
        if (!data) {
          console.log(chalk.red(`  ✗ Failed to fetch skill`))
          return
        }

        const remoteVersion = data.manifest.version as string
        const localVersion = manifest.version as string

        if (remoteVersion === localVersion) {
          console.log(chalk.green(`  ✓ Skill "${name}" is already up to date (v${localVersion})`))
          return
        }

        writeFileSync(join(skillDir, "skill.json"), JSON.stringify(data.manifest, null, 2))
        writeFileSync(join(skillDir, "index.js"), data.code)

        console.log(chalk.green(`  ✓ Skill "${name}" updated from v${localVersion} to v${remoteVersion}`))
      } catch {
        console.log(chalk.red(`  ✗ Failed to connect to marketplace`))
      }
    })

  skill
    .command("remove")
    .description("Remove an installed skill")
    .argument("<name>", "Skill name")
    .action((name: string) => {
      const skillDir = join(SKILLS_DIR, name)

      if (!existsSync(skillDir)) {
        console.log(chalk.red(`  ✗ Skill "${name}" is not installed`))
        return
      }

      rmSync(skillDir, { recursive: true, force: true })
      console.log(chalk.green(`  ✓ Skill "${name}" removed`))
    })
}
