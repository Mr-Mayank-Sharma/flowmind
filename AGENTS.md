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
- Always run `tsc --noEmit` on both `apps/api` and `apps/web` after changes
- Keep both projects at zero TypeScript errors
