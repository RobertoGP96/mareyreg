import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: [
        "src/modules/inventory/lib/effective-price.ts",
        "src/modules/inventory/actions/discount-actions.ts",
      ],
      exclude: ["src/components/ui/**", "generated/**", ".next/**"],
    },
  },
});
