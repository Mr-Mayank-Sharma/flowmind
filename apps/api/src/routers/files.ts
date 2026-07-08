import { z } from "zod";
import { router, protectedProcedure } from "../middleware/trpc";
import fs from "fs";
import path from "path";

const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || process.cwd();

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
    .query(async ({ input }) => {
      const basePath = path.join(WORKSPACE_ROOT, input.dir);
      const tree = buildTree(basePath);
      return { path: input.dir, children: tree };
    }),

  read: protectedProcedure
    .input(z.object({ file: z.string() }))
    .query(async ({ input }) => {
      try {
        const filePath = path.join(WORKSPACE_ROOT, input.file);
        const content = fs.readFileSync(filePath, "utf-8");
        const stat = fs.statSync(filePath);
        return { content, size: stat.size, modifiedAt: stat.mtime.toISOString() };
      } catch (e) {
        throw new Error(`File not found: ${input.file}`);
      }
    }),

  delete: protectedProcedure
    .input(z.object({ file: z.string() }))
    .mutation(async ({ input }) => {
      try {
        const filePath = path.join(WORKSPACE_ROOT, input.file);
        fs.unlinkSync(filePath);
        return { success: true };
      } catch {
        return { success: false };
      }
    }),
});
