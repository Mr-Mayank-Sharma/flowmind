# Agent Template Spec

An **Agent Template** is a pre-configured agent blueprint with tool bindings, memory config, and system prompt, published on the Marketplace for one-click deployment.

## Manifest fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Display name (3-64 chars) |
| `description` | string | yes | Short description of the agent's purpose |
| `version` | string | yes | SemVer string |
| `systemPrompt` | string | yes | System prompt for the agent |
| `model` | string | no | Preferred model |
| `temperature` | number | no | Default temperature (0-2, default 0.7) |
| `maxTokens` | number | no | Default max output tokens (default 4096) |
| `memory` | MemoryConfig | no | Memory configuration |
| `tools` | ToolBinding[] | no | Tool definitions the agent can use |
| `tags` | string[] | no | Searchable keywords |

### MemoryConfig

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | "sliding" \| "summary" \| "hybrid" | yes | Memory management strategy |
| `windowSize` | number | no | Message count for sliding window (default 20) |
| `ttlMs` | number | no | Message time-to-live in ms |

### ToolBinding

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Tool identifier |
| `description` | string | yes | Description shown to the LLM |
| `inputSchema` | JSON Schema | no | Expected input format |

## Example

```json
{
  "name": "Customer Support Agent",
  "description": "Handles common customer inquiries, triages issues, and escalates to human agents",
  "version": "2.1.0",
  "systemPrompt": "You are a helpful customer support agent...",
  "model": "mistral:7b",
  "temperature": 0.5,
  "memory": { "type": "hybrid", "windowSize": 30 },
  "tools": [
    {
      "name": "search_knowledge_base",
      "description": "Search the company knowledge base for answers",
      "inputSchema": { "type": "object", "properties": { "query": { "type": "string" } } }
    },
    {
      "name": "create_ticket",
      "description": "Create a support ticket for human follow-up",
      "inputSchema": { "type": "object", "properties": { "subject": { "type": "string" }, "priority": { "type": "string", "enum": ["low", "medium", "high"] } } }
    }
  ],
  "tags": ["support", "customer-service", "triage"]
}
```
