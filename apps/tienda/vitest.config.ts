import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  // tsconfig usa jsx "preserve" (Next): para importar store.tsx en node hay
  // que compilar el JSX aquí.
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
