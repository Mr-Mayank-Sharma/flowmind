# Getting Started

## Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL 14+
- Redis 7+

## Installation

```bash
git clone https://github.com/your-org/flowmind.git
cd flowmind
pnpm install
```

## Configuration

```bash
cp .env.example .env
```

Edit `.env` with your database URL, Redis URL, and API keys:

```
DATABASE_URL=postgresql://localhost:5432/flowmind
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
OPENAI_API_KEY=sk-...       # optional
OLLAMA_BASE_URL=http://localhost:11434  # optional
```

## Database Setup

```bash
pnpm db:generate
pnpm db:seed
```

This creates:
- Admin user: `admin@flowmind.ai` / `admin123`
- 5 demo workflows with multi-node graphs
- Marketplace categories

## Start Development

```bash
pnpm dev
```

- **API**: http://localhost:3001
- **Web UI**: http://localhost:3000

## First Pipeline

1. Open http://localhost:3000/pipelines
2. Click "New Pipeline"
3. Drag a "Manual Trigger" node onto the canvas
4. Drag an "AI Agent" node and connect it to the trigger
5. Configure the AI Agent with a prompt
6. Click "Run" to execute

## First Chat

1. Open http://localhost:3000/chat
2. Start a new conversation
3. Type a message — the AI will respond using your configured model
4. The AI can use tools (read files, search, run code) based on your tool configuration

## Marketplace

Browse pre-built workflows at http://localhost:3000/marketplace:
- Clone any workflow to your workspace
- Browse Skills for reusable components
- Publish your own workflows and skills
