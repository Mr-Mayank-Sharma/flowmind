import { z } from "zod"

export const SkillInputTypeSchema = z.enum(["string", "number", "boolean", "object", "array", "file"])
export const SkillOutputTypeSchema = z.enum(["string", "number", "boolean", "object", "array", "file"])
export const SkillRuntimeSchema = z.enum(["sandboxed-js", "sandboxed-ts", "native"])
export const SkillPermissionSchema = z.enum(["webfetch", "filewrite", "fileread", "bash", "database", "network"])

export const SkillInputSchema = z.object({
  name: z.string().min(1),
  type: SkillInputTypeSchema,
  required: z.boolean().default(true),
  description: z.string().optional(),
  default: z.unknown().optional(),
})

export const SkillOutputSchema = z.object({
  name: z.string().min(1),
  type: SkillOutputTypeSchema,
  description: z.string().optional(),
})

export const SkillDependencySchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
})

export const SkillManifestSchema = z.object({
  name: z.string().min(1).regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, "must be kebab-case"),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "must be semver (x.y.z)"),
  description: z.string().min(1).max(500),
  author: z.string().min(1),
  runtime: SkillRuntimeSchema,
  entryPoint: z.string().min(1),
  inputs: z.array(SkillInputSchema).default([]),
  outputs: z.array(SkillOutputSchema).default([]),
  permissions: z.array(SkillPermissionSchema).default([]),
  dependencies: z.array(SkillDependencySchema).default([]),
  compatibility: z.string().default(">=0.1.0"),
  icon: z.string().optional(),
  tags: z.array(z.string()).default([]),
})

export type SkillInputType = z.infer<typeof SkillInputTypeSchema>
export type SkillOutputType = z.infer<typeof SkillOutputTypeSchema>
export type SkillRuntime = z.infer<typeof SkillRuntimeSchema>
export type SkillPermission = z.infer<typeof SkillPermissionSchema>
export type SkillInput = z.infer<typeof SkillInputSchema>
export type SkillOutput = z.infer<typeof SkillOutputSchema>
export type SkillDependency = z.infer<typeof SkillDependencySchema>
export type SkillManifest = z.infer<typeof SkillManifestSchema>

export function validateManifest(data: unknown): { success: true; manifest: SkillManifest } | { success: false; errors: string[] } {
  const result = SkillManifestSchema.safeParse(data)
  if (result.success) {
    return { success: true, manifest: result.data }
  }
  return {
    success: false,
    errors: result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
  }
}

export function generateSkillTemplate(name: string, author: string): { manifest: SkillManifest; entryPoint: string; readme: string; testFile: string } {
  const manifest: SkillManifest = {
    name,
    version: "0.1.0",
    description: `A FlowMind skill: ${name}`,
    author,
    runtime: "sandboxed-js",
    entryPoint: "index.js",
    inputs: [
      { name: "input", type: "string", required: true, description: "Input text" },
    ],
    outputs: [
      { name: "result", type: "string", description: "Output result" },
    ],
    permissions: [],
    dependencies: [],
    compatibility: ">=0.1.0",
    tags: [],
  }

  const entryPoint = `// ${name} skill entry point
// Receives: input (string), context (object with userId, sessionId)
// Must return a string result

function execute(input, context) {
  return "Processed: " + input;
}

module.exports = { execute };
`

  const readme = `# ${name}

${manifest.description}

## Inputs

| Name | Type | Required | Description |
|------|------|----------|-------------|
${manifest.inputs.map((inp: SkillInput) => `| ${inp.name} | ${inp.type} | ${inp.required} | ${inp.description || "-"} |`).join("\n")}

## Outputs

| Name | Type | Description |
|------|------|-------------|
${manifest.outputs.map((out: SkillOutput) => `| ${out.name} | ${out.type} | ${out.description || "-"} |`).join("\n")}

## Usage

\`\`\`bash
flowmind skill run ${name} --input '{"input": "hello"}'
\`\`\`
`

  const testFile = `const { execute } = require("./index.js");

const result = execute("hello", { userId: "test-user" });
console.assert(typeof result === "string", "Result should be a string");
console.assert(result.includes("hello"), "Result should contain input");
console.log("All tests passed:", result);
`

  return { manifest, entryPoint, readme, testFile }
}
