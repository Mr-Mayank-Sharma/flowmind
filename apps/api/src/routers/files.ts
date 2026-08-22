import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../middleware/trpc";
import fs from "fs";
import path from "path";
import os from "os";

const BASE_WORKSPACE = path.resolve(
  process.env.WORKSPACE_ROOT || path.join(os.homedir(), ".flowmind", "workspace"),
);

const BLOCKED_PATTERNS = [/^\.env/i, /secret/i, /credential/i, /\.pem$/i, /\.key$/i];

function workspaceRoot(userId: string): string {
  const root = path.join(BASE_WORKSPACE, userId);
  fs.mkdirSync(root, { recursive: true });
  return root;
}

function safeResolve(root: string, relPath: string): string | null {
  if (relPath === "/" || relPath === "") return root;
  const resolved = path.resolve(root, relPath.replace(/^[/\\]+/, ""));
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    return null;
  }
  return resolved;
}

function assertNotBlocked(relPath: string): void {
  const base = path.basename(relPath);
  if (BLOCKED_PATTERNS.some((p) => p.test(base))) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Access to this file is not allowed" });
  }
}

function buildTree(dirPath: string, depth: number = 0, maxDepth: number = 4): any[] {
  if (depth > maxDepth) return [{ name: "...", type: "more" as const }];
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    return entries
      .filter((e) => !e.name.startsWith("."))
      .slice(0, 50)
      .map((entry) => {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          return {
            name: entry.name,
            type: "folder" as const,
            children: buildTree(fullPath, depth + 1, maxDepth),
          };
        }
        const stat = fs.statSync(fullPath);
        return {
          name: entry.name,
          type: "file" as const,
          size: stat.size,
          modifiedAt: stat.mtime.toISOString(),
        };
      });
  } catch {
    return [];
  }
}

export const filesRouter = router({
  list: protectedProcedure
    .input(z.object({ dir: z.string().default("/") }))
    .query(async ({ input, ctx }) => {
      const root = workspaceRoot(ctx.userId!);
      const basePath = safeResolve(root, input.dir);
      if (!basePath || !fs.existsSync(basePath) || !fs.statSync(basePath).isDirectory()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid directory" });
      }
      const tree = buildTree(basePath);
      return { path: input.dir, children: tree };
    }),

  read: protectedProcedure
    .input(z.object({ file: z.string() }))
    .query(async ({ input, ctx }) => {
      assertNotBlocked(input.file);
      const root = workspaceRoot(ctx.userId!);
      const filePath = safeResolve(root, input.file);
      if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        throw new TRPCError({ code: "NOT_FOUND", message: "File not found" });
      }
      try {
        const content = fs.readFileSync(filePath, "utf-8");
        const stat = fs.statSync(filePath);
        return { content, size: stat.size, modifiedAt: stat.mtime.toISOString() };
      } catch {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to read file" });
      }
    }),

  delete: protectedProcedure
    .input(z.object({ file: z.string() }))
    .mutation(async ({ input, ctx }) => {
      assertNotBlocked(input.file);
      const root = workspaceRoot(ctx.userId!);
      const filePath = safeResolve(root, input.file);
      if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        throw new TRPCError({ code: "NOT_FOUND", message: "File not found" });
      }
      try {
        fs.unlinkSync(filePath);
        return { success: true };
      } catch {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to delete file" });
      }
    }),
});
