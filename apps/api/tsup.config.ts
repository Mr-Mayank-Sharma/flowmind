import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  outDir: "dist",
  format: ["cjs"],
  platform: "node",
  target: "node18",
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  external: ["@prisma/client", "isolated-vm"],
  noExternal: [/^@flowmind\//],
});
