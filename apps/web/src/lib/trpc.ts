import { createTRPCClient, httpBatchLink, type TRPCClient } from "@trpc/client";
import type { AppRouter } from "@flowmind/api";
import { API_URL, getToken } from "@/lib/api";

export const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${API_URL}/trpc`,
      headers: () => ({ Authorization: `Bearer ${getToken()}` }),
    }),
  ],
}) as TRPCClient<AppRouter>;
