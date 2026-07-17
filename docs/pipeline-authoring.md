# Pipeline Authoring

## Node Types

### Triggers

| Type | Description |
|---|---|
| `manualTrigger` | User clicks "Run" |
| `cronTrigger` | Scheduled execution (cron expression) |
| `webhookTrigger` | HTTP webhook endpoint |
| `channelTrigger` | Message from a channel (Slack, Telegram, etc.) |
| `pollingTrigger` | Periodic polling |

### AI Nodes

| Type | Description |
|---|---|
| `aiAgent` | General-purpose LLM agent |
| `contentWriter` | Content generation with tone/style |
| `dataExtractor` | Structured data extraction from text |
| `classifier` | Multi-category classification |
| `summarizer` | Text summarization |
| `webResearcher` | Web research with synthesis |
| `imageGenerator` | Image generation |

### Actions

| Type | Description |
|---|---|
| `httpRequest` | HTTP API calls |
| `databaseQuery` | SQL database queries |
| `sendEmail` | Send emails |
| `sendMessage` | Send to channels |
| `codeExecute` | Run JavaScript/TypeScript code |
| `openhumanMessage` | Send to OpenHuman agent |
| `subPipeline` | Execute another pipeline |

### Flow Control

| Type | Description |
|---|---|
| `condition` | If/else branching |
| `switch` | Multi-way branching |
| `parallelFork` | Execute branches in parallel |
| `merge` | Combine parallel branches |
| `loop` | Iterate over items |
| `wait` | Pause execution |

## Expression Engine

Reference data from other nodes using expressions:

| Expression | Description |
|---|---|
| `{{trigger.input}}` | Input from the trigger node |
| `{{node-name.output}}` | Output from a specific node |
| `{{$json.field}}` | Current node's input JSON field |
| `{{$env.API_KEY}}` | Environment variable |
| `{{$now.toISOString()}}` | Current timestamp |

## Credentials

Store sensitive values as encrypted credentials:

1. Go to Settings → Connections
2. Add a new credential (API key, OAuth token, etc.)
3. Reference in node config: `{{credential:cred-abc123}}`

## Execution Order

- Sequential by default (topological sort)
- Parallel fork/join for concurrent execution
- Loop nodes iterate over arrays
- Condition nodes branch based on expressions
