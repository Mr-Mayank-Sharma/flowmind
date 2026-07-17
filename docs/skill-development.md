# Skill Development

## Overview

Skills are reusable, sandboxed components that can be installed from the marketplace and used as pipeline nodes.

## skill.json Spec

```json
{
  "name": "seo-optimizer",
  "version": "1.0.0",
  "description": "Analyzes and optimizes webpage SEO",
  "author": "your-name",
  "runtime": "sandboxed-js",
  "entryPoint": "./index.js",
  "inputs": [
    { "name": "url", "type": "string", "required": true },
    { "name": "keywords", "type": "string", "required": false }
  ],
  "outputs": [
    { "name": "report", "type": "object" }
  ],
  "permissions": ["webfetch"],
  "compatibility": ">=1.0.0"
}
```

## Creating a Skill

```bash
flowmind skill create my-skill
```

This scaffolds:

```
my-skill/
  skill.json
  index.js
  README.md
```

## Writing the Skill

Edit `index.js`:

```javascript
async function execute(input, context) {
  const { url } = input;

  // Your skill logic here
  const report = { score: 85, issues: [] };

  return { report };
}

module.exports = { execute };
```

The `execute` function receives:
- `input` — Values matching the declared inputs
- `context` — `{ userId, sessionId, env }` for accessing credentials

## Publishing

```bash
flowmind skill publish
```

This validates `skill.json`, packages the skill, and uploads it to the marketplace.

## Permissions

Skills declare required permissions:

| Permission | Description |
|---|---|
| `webfetch` | Fetch URLs |
| `filewrite` | Write local files |
| `execute` | Run shell commands |
| `database` | Access database |
| `email` | Send emails |

## Running Locally

```bash
flowmind skill run my-skill --input '{"url": "https://example.com"}'
```

## Using in Pipelines

Skills appear in the pipeline node palette under "Skills". Drag a skill node onto the canvas and configure it with the required inputs.
