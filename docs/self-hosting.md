# Self-Hosting

## Docker Compose

```bash
docker compose up -d
```

Services: `api`, `web`, `postgres`, `redis`

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `REDIS_URL` | Yes | — | Redis connection string |
| `JWT_SECRET` | Yes | — | Token signing secret |
| `OPENAI_API_KEY` | No | — | OpenAI API key |
| `ANTHROPIC_API_KEY` | No | — | Anthropic API key |
| `OLLAMA_BASE_URL` | No | `http://localhost:11434` | Ollama server URL |
| `APP_URL` | No | `http://localhost:3000` | Public app URL |
| `API_PORT` | No | `3001` | API server port |
| `WEB_PORT` | No | `3000` | Web UI port |

## Database

```bash
# Create database
createdb flowmind

# Run migrations
pnpm db:generate

# Seed demo data
pnpm db:seed
```

## Ollama (Local Models)

```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Pull models
ollama pull llama3.1
ollama pull codellama

# FlowMind auto-detects Ollama at localhost:11434
```

## Production Deploy

```bash
# Build
pnpm build

# Start
cd apps/api && node dist/index.js
cd apps/web && node .next/standalone/server.js
```

## Reverse Proxy (Nginx)

```nginx
server {
    listen 443 ssl;
    server_name flowmind.example.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
    }

    location /trpc/ {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
    }
}
```
