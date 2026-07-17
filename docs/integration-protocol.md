# FlowMind Integration Protocol

## Overview

FlowMind supports two integration patterns:

1. **Tool Registration** — External tools register via MCP protocol or HTTP adapter
2. **Runtime Registration** — Agent runtimes register via HTTP with a capabilities manifest

## Tool Registration

### MCP Protocol

External tools that speak the Model Context Protocol (MCP) can register dynamically:

```
POST /api/mcp/register
Content-Type: application/json

{
  "name": "my-mcp-server",
  "endpoint": "http://localhost:3000",
  "transport": "stdio" | "sse",
  "tools": [
    {
      "name": "search_docs",
      "description": "Search documentation",
      "inputSchema": { ... }
    }
  ]
}
```

### HTTP Adapter

Tools without MCP support can register via HTTP:

```
POST /api/tools/register
Content-Type: application/json

{
  "id": "custom-tool-1",
  "name": "My Custom Tool",
  "description": "Does something useful",
  "endpoint": "http://localhost:8080/execute",
  "method": "POST",
  "inputSchema": { ... }
}
```

## Runtime Registration

Agent runtimes (external processes that execute pipeline nodes) register via:

```
POST /trpc/runtime.register
Content-Type: application/json

{
  "name": "Python Agent Runtime",
  "endpoint": "http://localhost:8001",
  "description": "Python-based agent for data processing",
  "version": "1.0.0",
  "capabilities": [
    {
      "name": "data-extraction",
      "description": "Extract structured data from text",
      "supportedNodeTypes": ["dataExtractor", "codeExecute"],
      "maxConcurrent": 4
    }
  ],
  "healthCheckPath": "/health"
}
```

### Capabilities Manifest

Each runtime declares its capabilities:

| Field | Type | Description |
|---|---|---|
| `name` | string | Capability identifier |
| `description` | string | Human-readable description |
| `supportedNodeTypes` | string[] | Pipeline node types this runtime can handle |
| `supportedInputTypes` | string[] | Input MIME types supported |
| `maxConcurrent` | number | Maximum concurrent executions |

### Task Dispatch

When a pipeline executes a node, FlowMind's `RuntimeRegistry.dispatch()` matches the node type against registered runtimes:

1. Filter to online runtimes
2. Filter to runtimes with matching capabilities
3. Select the runtime with lowest current load
4. Forward the task to the runtime's endpoint

```
POST {runtime.endpoint}/execute
Content-Type: application/json
Authorization: {runtime.authHeader}

{
  "taskId": "task-abc-123",
  "nodeType": "dataExtractor",
  "input": { ... },
  "context": { ... }
}
```

### Health Checks

FlowMind automatically polls each registered runtime every 30 seconds:

```
GET {runtime.endpoint}{runtime.healthCheckPath}
```

Runtimes are marked:
- **online** — Health check succeeds
- **degraded** — Health check returns non-2xx
- **offline** — Health check times out or fails

## Configuration

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `RUNTIME_REGISTRY_TTL` | `30000` | Health check interval in ms |
| `RUNTIME_DISPATCH_TIMEOUT` | `10000` | Task dispatch timeout in ms |

### API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/trpc/runtime.list` | GET | List all registered runtimes |
| `/trpc/runtime.register` | POST | Register a new runtime |
| `/trpc/runtime.unregister` | POST | Remove a runtime |
| `/trpc/runtime.dispatch` | GET | Find best matching runtime for a task |
