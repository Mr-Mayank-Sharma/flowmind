# Plugin Spec

A **Plugin** is a packaged Node.js module (ESM or CJS) that extends FlowMind's core capabilities — custom node types, new transport channels, credential providers, or hooks into pipeline lifecycle events.

## Manifest fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Package name (npm-style) |
| `description` | string | yes | Short description |
| `version` | string | yes | SemVer string |
| `entrypoint` | string | yes | Relative path to the plugin's main module |
| `type` | "node" \| "channel" \| "credential" \| "hook" \| "theme" | yes | Plugin category |
| `runtime` | "node" \| "isolated-vm" | no | Execution runtime (default "node") |
| `capabilities` | string[] | yes | Declared capabilities (e.g. ["http:fetch", "fs:read", "kv:write"]) |
| `hooks` | HookConfig[] | no | Lifecycle hooks the plugin subscribes to |
| `configSchema` | JSON Schema | no | Plugin-level configuration schema |
| `tags` | string[] | no | Searchable keywords |

### HookConfig

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `event` | string | yes | Event name (e.g. "pipeline:beforeExecute", "node:afterExecute") |
| `handler` | string | yes | Exported function name to call |
| `priority` | number | no | Execution priority (lower = runs first, default 100) |

## Example

```json
{
  "name": "@flowmind/slack-plugin",
  "description": "Slack integration — send messages, listen to events, and use Slack as a pipeline trigger",
  "version": "0.3.0",
  "entrypoint": "./dist/index.js",
  "type": "channel",
  "runtime": "node",
  "capabilities": ["http:fetch", "kv:write"],
  "hooks": [
    { "event": "pipeline:afterExecute", "handler": "notifySlack", "priority": 50 }
  ],
  "configSchema": {
    "type": "object",
    "properties": {
      "webhookUrl": { "type": "string", "format": "uri" },
      "defaultChannel": { "type": "string", "default": "#general" }
    }
  },
  "tags": ["slack", "communication", "notifications"]
}
```
