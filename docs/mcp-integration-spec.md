# MCP Integration Spec

An **MCP Integration** packages an MCP server configuration (including authentication, tool signatures, and transport details) for one-click installation from the Marketplace.

## Manifest fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Display name |
| `description` | string | yes | Short description |
| `version` | string | yes | SemVer string |
| `serverUrl` | string | yes | MCP server endpoint URL |
| `transport` | "stdio" \| "sse" \| "streamable-http" | yes | Transport protocol |
| `authType` | "none" \| "api-key" \| "oauth2" \| "bearer" | no | Authentication method |
| `authConfig` | AuthConfig | no | Auth configuration |
| `tools` | MCPTool[] | yes | Array of tool signatures |
| `resources` | MCPResource[] | no | Exposed resources |
| `prompts` | MCPPrompt[] | no | Prompt templates exposed by server |
| `tags` | string[] | no | Searchable keywords |

### AuthConfig

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `headerName` | string | no | Header name for API key / bearer token |
| `scopes` | string[] | no | Required OAuth scopes |
| `tokenUrl` | string | no | OAuth token endpoint |

### MCPTool

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Tool name |
| `description` | string | yes | Tool description |
| `inputSchema` | JSON Schema | no | Expected argument format |

### MCPResource

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `uri` | string | yes | Resource URI template |
| `name` | string | yes | Resource name |
| `mimeType` | string | no | Expected MIME type |

### MCPPrompt

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Prompt name |
| `description` | string | yes | Prompt description |
| `arguments` | PromptArg[] | no | Template arguments |

## Example

```json
{
  "name": "GitHub MCP Server",
  "description": "MCP integration for GitHub API — manage repos, PRs, issues, and actions",
  "version": "1.0.0",
  "serverUrl": "https://mcp.github.com/v1",
  "transport": "streamable-http",
  "authType": "oauth2",
  "authConfig": { "scopes": ["repo", "issues"], "tokenUrl": "https://github.com/login/oauth/access_token" },
  "tools": [
    { "name": "create_issue", "description": "Create a new issue", "inputSchema": { "type": "object", "properties": { "title": { "type": "string" }, "body": { "type": "string" } } } }
  ],
  "tags": ["github", "dev-tools", "source-control"]
}
```
