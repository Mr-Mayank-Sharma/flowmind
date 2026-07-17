import { router } from "../middleware/trpc";
import { chatRouter } from "./chat";
import { pipelineRouter } from "./pipeline";
import { marketplaceRouter } from "./marketplace";
import { systemRouter } from "./system";
import { authRouter } from "./auth";
import { billingRouter } from "./billing";
import { settingsRouter } from "./settings";
import { modelsRouter } from "./models";
import { jobsRouter } from "./jobs";
import { toolsRouter } from "./tools";
import { mcpRouter } from "./mcp";
import { playgroundRouter } from "./playground";
import { filesRouter } from "./files";
import { knowledgeRouter } from "./knowledge";
import { agentsRouter } from "./agents";
import { toolsV2Router } from "./tools-v2";
import { consoleRouter } from "./console";
import { notificationsRouter } from "./notifications";
import { webhooksRouter } from "./webhooks";
import { contextRouter } from "./context";
import { skillsRouter } from "./skills";

export const appRouter = router({
  chat: chatRouter,
  pipeline: pipelineRouter,
  marketplace: marketplaceRouter,
  system: systemRouter,
  auth: authRouter,
  billing: billingRouter,
  settings: settingsRouter,
  models: modelsRouter,
  jobs: jobsRouter,
  tools: toolsRouter,
  mcp: mcpRouter,
  playground: playgroundRouter,
  files: filesRouter,
  knowledge: knowledgeRouter,
  agents: agentsRouter,
  toolsV2: toolsV2Router,
  console: consoleRouter,
  notifications: notificationsRouter,
  webhooks: webhooksRouter,
  context: contextRouter,
  skills: skillsRouter,
});

export type AppRouter = typeof appRouter;
