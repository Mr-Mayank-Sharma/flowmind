# Prompt Pack Spec

A **Prompt Pack** is a curated collection of prompts designed for a specific use case, packaged for sharing and reuse via the FlowMind Marketplace.

## Manifest fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Display name (3-64 chars) |
| `description` | string | yes | Short description of the pack's purpose |
| `version` | string | yes | SemVer string |
| `prompts` | PromptDef[] | yes | Array of prompt definitions |
| `model` | string | no | Recommended model (e.g. "gpt-4") |
| `tags` | string[] | no | Searchable keywords |
| `locale` | string | no | Primary language (ISO 639-1, default "en") |

### PromptDef

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | yes | Unique ID within the pack |
| `name` | string | yes | Human-readable prompt name |
| `systemPrompt` | string | yes | System-level instruction |
| `userTemplate` | string | no | User message template with `{{variable}}` placeholders |
| `temperature` | number | no | Default temperature (0-2, default 1.0) |
| `maxTokens` | number | no | Default max output tokens (default 2048) |
| `variables` | VariableDef[] | no | Declared input variables |

### VariableDef

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Variable name matching `{{name}}` in template |
| `type` | "string" \| "number" \| "boolean" \| "select" | yes | Expected value type |
| `options` | string[] | no | Allowed values if type="select" |
| `default` | unknown | no | Default value |
| `required` | boolean | no | Whether variable must be provided |

## Example

```json
{
  "name": "Code Review Prompts",
  "description": "A set of prompts for automated code review across multiple dimensions",
  "version": "1.0.0",
  "model": "gpt-4",
  "tags": ["code-review", "quality", "security"],
  "prompts": [
    {
      "id": "quality",
      "name": "Code Quality Review",
      "systemPrompt": "You are a senior engineer reviewing a pull request...",
      "userTemplate": "Review the following diff:\n\n{{diff}}",
      "temperature": 0.3,
      "variables": [
        { "name": "diff", "type": "string", "required": true }
      ]
    }
  ]
}
```
