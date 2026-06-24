import { router } from "../middleware/trpc";
import { chatRouter } from "./chat";
import { pipelineRouter } from "./pipeline";
import { marketplaceRouter } from "./marketplace";
import { systemRouter } from "./system";
import { authRouter } from "./auth";
import { billingRouter } from "./billing";
import { settingsRouter } from "./settings";
import { modelsRouter } from "./models";

export const appRouter = router({
  chat: chatRouter,
  pipeline: pipelineRouter,
  marketplace: marketplaceRouter,
  system: systemRouter,
  auth: authRouter,
  billing: billingRouter,
  settings: settingsRouter,
  models: modelsRouter,
});

export type AppRouter = typeof appRouter;
