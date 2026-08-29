import { z } from "zod"
import * as path from "path"
import * as fs from "fs"
import * as dotenv from "dotenv"

const candidateEnvPaths = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "../../.env"),
  path.resolve(process.cwd(), "../../apps/api/.env"),
]

const existingEnvPaths = candidateEnvPaths.filter((p) => fs.existsSync(p))
if (existingEnvPaths.length > 0) {
  dotenv.config({ path: existingEnvPaths, quiet: true })
  console.info(`[config] Loaded env from: ${existingEnvPaths.join(", ")}`)
}

const rawEnv = {
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL || process.env.OLLAMA_URL || "http://localhost:11434",
  openaiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_KEY,
  anthropicKey: process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_KEY,
  googleKey: process.env.GOOGLE_API_KEY || process.env.GOOGLE_KEY,
  groqKey: process.env.GROQ_API_KEY || process.env.GROQ_KEY,
  deepseekKey: process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_KEY,
  openrouterKey: process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_KEY,
  togetherKey: process.env.TOGETHER_API_KEY || process.env.TOGETHER_KEY,
  mistralKey: process.env.MISTRAL_API_KEY || process.env.MISTRAL_KEY,
  perplexityKey: process.env.PERPLEXITY_API_KEY || process.env.PERPLEXITY_KEY,
  deepinfraKey: process.env.DEEPINFRA_API_KEY || process.env.DEEPINFRA_KEY,
  cerebrasKey: process.env.CEREBRAS_API_KEY || process.env.CEREBRAS_KEY,
  xaiKey: process.env.XAI_API_KEY || process.env.XAI_KEY,
  cohereKey: process.env.COHERE_API_KEY || process.env.COHERE_KEY,
  cloudflareKey: process.env.CLOUDFLARE_API_KEY || process.env.CLOUDFLARE_KEY,
  veniceAIKey: process.env.VENICE_AI_KEY,
  alibabaKey: process.env.ALIBABA_API_KEY || process.env.ALIBABA_KEY,
  internalApiKey: process.env.AGENT_API_KEY || process.env.INTERNAL_API_KEY || process.env.INTERNAL_API_TOKEN,
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  redisUrl: process.env.REDIS_URL,
  encryptionKey: process.env.ENCRYPTION_KEY,
  appUrl: process.env.APP_URL,
  apiUrl: process.env.API_URL,
  nodeEnv: process.env.NODE_ENV,
  agentRuntimeUrl: process.env.AGENT_RUNTIME_URL || "http://localhost:8001",
  sentryDsn: process.env.SENTRY_DSN,
}

const configSchema = z.object({
  ollamaBaseUrl: z.string(),
  openaiKey: z.string().optional(),
  anthropicKey: z.string().optional(),
  googleKey: z.string().optional(),
  groqKey: z.string().optional(),
  deepseekKey: z.string().optional(),
  openrouterKey: z.string().optional(),
  togetherKey: z.string().optional(),
  mistralKey: z.string().optional(),
  perplexityKey: z.string().optional(),
  deepinfraKey: z.string().optional(),
  cerebrasKey: z.string().optional(),
  xaiKey: z.string().optional(),
  cohereKey: z.string().optional(),
  cloudflareKey: z.string().optional(),
  veniceAIKey: z.string().optional(),
  alibabaKey: z.string().optional(),
  internalApiKey: z.string().optional(),
  databaseUrl: z.string().optional(),
  jwtSecret: z.string().optional(),
  redisUrl: z.string().optional(),
  encryptionKey: z.string().optional(),
  appUrl: z.string().optional(),
  apiUrl: z.string().optional(),
  nodeEnv: z.string().optional(),
  agentRuntimeUrl: z.string(),
  sentryDsn: z.string().optional(),
})

export const config = configSchema.parse(rawEnv)

export function getEnvString(key: string): string | undefined {
  return process.env[key]
}