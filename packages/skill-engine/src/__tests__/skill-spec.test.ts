import { describe, it, expect } from "vitest"
import { validateManifest, generateSkillTemplate, SkillManifestSchema } from "../skill-spec"

describe("SkillManifestSchema", () => {
  it("validates a correct manifest", () => {
    const result = SkillManifestSchema.safeParse({
      name: "my-skill",
      version: "1.0.0",
      description: "A test skill",
      author: "test-user",
      runtime: "sandboxed-js",
      entryPoint: "index.js",
    })
    expect(result.success).toBe(true)
  })

  it("rejects non-kebab-case names", () => {
    const result = SkillManifestSchema.safeParse({
      name: "My_Skill",
      version: "1.0.0",
      description: "test",
      author: "test",
      runtime: "sandboxed-js",
      entryPoint: "index.js",
    })
    expect(result.success).toBe(false)
  })

  it("rejects invalid semver", () => {
    const result = SkillManifestSchema.safeParse({
      name: "my-skill",
      version: "1.0",
      description: "test",
      author: "test",
      runtime: "sandboxed-js",
      entryPoint: "index.js",
    })
    expect(result.success).toBe(false)
  })

  it("applies defaults for optional fields", () => {
    const result = SkillManifestSchema.parse({
      name: "my-skill",
      version: "1.0.0",
      description: "test",
      author: "test",
      runtime: "sandboxed-js",
      entryPoint: "index.js",
    })
    expect(result.inputs).toEqual([])
    expect(result.outputs).toEqual([])
    expect(result.permissions).toEqual([])
    expect(result.dependencies).toEqual([])
    expect(result.compatibility).toBe(">=0.1.0")
    expect(result.tags).toEqual([])
  })
})

describe("validateManifest", () => {
  it("returns success for valid manifest", () => {
    const result = validateManifest({
      name: "my-skill",
      version: "1.0.0",
      description: "test",
      author: "test",
      runtime: "sandboxed-js",
      entryPoint: "index.js",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.manifest.name).toBe("my-skill")
    }
  })

  it("returns errors for invalid manifest", () => {
    const result = validateManifest({ name: 123 })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errors.length).toBeGreaterThan(0)
    }
  })
})

describe("generateSkillTemplate", () => {
  it("generates manifest with correct name and author", () => {
    const template = generateSkillTemplate("hello-world", "alice")
    expect(template.manifest.name).toBe("hello-world")
    expect(template.manifest.author).toBe("alice")
    expect(template.manifest.version).toBe("0.1.0")
    expect(template.manifest.runtime).toBe("sandboxed-js")
    expect(template.manifest.entryPoint).toBe("index.js")
  })

  it("generates valid entry point code", () => {
    const template = generateSkillTemplate("test", "author")
    expect(template.entryPoint).toContain("function execute")
    expect(template.entryPoint).toContain("module.exports")
  })

  it("generates readme with inputs and outputs tables", () => {
    const template = generateSkillTemplate("test", "author")
    expect(template.readme).toContain("# test")
    expect(template.readme).toContain("| input |")
    expect(template.readme).toContain("| result |")
  })

  it("generates runnable test file", () => {
    const template = generateSkillTemplate("test", "author")
    expect(template.testFile).toContain("execute(")
    expect(template.testFile).toContain("console.assert")
  })

  it("generated manifest passes validation", () => {
    const template = generateSkillTemplate("my-skill", "author")
    const result = validateManifest(template.manifest)
    expect(result.success).toBe(true)
  })
})
