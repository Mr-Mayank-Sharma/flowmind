# FlowMind Project Instructions

## Response Style
- Be direct and concise — answer in as few words as possible
- Never use "Let me...", "I'll...", "I see that...", "Now let me..."
- No preamble before actions — just do the work and show results
- No postamble after work — short factual summary at most
- No emoji unless explicitly asked

## Tool Usage
- Show tool calls directly without explaining what you're about to do
- Batch independent tool calls for efficiency
- After multi-step work, report what changed in 1 line max

## Code Style
- TypeScript with strict types, no `any` where avoidable
- Follow existing patterns in the codebase
- No comments unless necessary
- Use Lucide icons, never emoji strings

## Verification
- The gate is the root command, not a per-package one: `pnpm typecheck`, `pnpm lint`, `pnpm test`
- `tsc --noEmit` in `apps/api` and `apps/web` is a fast inner-loop check, not the gate
- CI runs those same root commands; `packages/db`, `packages/runtime-registry` and
  `packages/snapshot` only fail under `pnpm typecheck`, so an api+web-only check can pass
  while CI is already red — that is how four type errors and two lint errors reached `main`
- Keep the repo at zero TypeScript errors, zero lint problems, zero failing tests
