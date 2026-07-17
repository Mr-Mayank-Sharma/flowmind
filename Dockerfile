# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
RUN apk add --no-cache python3 make g++ libc6-compat
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

# Copy only dependency manifests for maximum layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/cli/package.json apps/cli/package.json
COPY apps/desktop/package.json apps/desktop/package.json
COPY packages/auth/package.json packages/auth/package.json
COPY packages/billing/package.json packages/billing/package.json
COPY packages/channel-gateway/package.json packages/channel-gateway/package.json
COPY packages/context-engine/package.json packages/context-engine/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/http-recorder/package.json packages/http-recorder/package.json
COPY packages/llm-router/package.json packages/llm-router/package.json
COPY packages/lsp/package.json packages/lsp/package.json
COPY packages/mcp-executor/package.json packages/mcp-executor/package.json
COPY packages/ollama-proxy/package.json packages/ollama-proxy/package.json
COPY packages/permission/package.json packages/permission/package.json
COPY packages/pipeline-engine/package.json packages/pipeline-engine/package.json
COPY packages/plugin-engine/package.json packages/plugin-engine/package.json
COPY packages/provider-registry/package.json packages/provider-registry/package.json
COPY packages/session-engine/package.json packages/session-engine/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/skill-engine/package.json packages/skill-engine/package.json
COPY packages/snapshot/package.json packages/snapshot/package.json
COPY packages/tool-system/package.json packages/tool-system/package.json
COPY packages/ui/package.json packages/ui/package.json
# agent-runtime is Python-based, no package.json needed here

RUN pnpm install --frozen-lockfile

# -----------------------------------------------------------
# Build stage — compiles all workspace packages and the target app
FROM base AS builder
WORKDIR /app
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY . .

# Generate Prisma client, then build API
RUN pnpm --filter @flowmind/db db:generate
RUN pnpm --filter @flowmind/api build

# -----------------------------------------------------------
# API runner — minimal production image
FROM node:22-alpine AS api
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/package.json ./package.json

# Copy workspace packages needed at runtime
COPY --from=builder /app/packages ./packages

# Copy compiled API output
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json

# Copy Prisma schema + migrations for runtime DB queries
COPY --from=builder /app/packages/db/prisma ./packages/db/prisma

EXPOSE 3001
CMD ["node", "apps/api/dist/index.js"]

# -----------------------------------------------------------
# Web runner — Next.js standalone
FROM node:22-alpine AS web
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Build web (separate build because we need the turbo pipeline)
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY . .

ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN pnpm --filter @flowmind/db db:generate && \
    pnpm --filter @flowmind/web build

# Strip down to standalone output only
FROM node:22-alpine AS web-runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=web /app/apps/web/.next/standalone ./
COPY --from=web /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=web /app/apps/web/public ./apps/web/public

EXPOSE 3000
CMD ["node", "apps/web/server.js"]
