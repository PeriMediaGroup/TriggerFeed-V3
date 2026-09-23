import { defineConfig, configDefaults } from "vitest/config";
import { fileURLToPath } from "node:url";
import { transformWithOxc } from "vite";

export default defineConfig({
  test: {
    passWithNoTests: true,
    exclude: [
      ...configDefaults.exclude,
      "tests/e2e/**",
      "playwright-report/**",
      "test-results/**",
    ],
    projects: [
      {
        extends: true,
        test: { name: "unit", exclude: ["**/*.hydration.test.jsx"] },
      },
      {
        extends: true,
        plugins: [{
          name: "next-jsx-in-js",
          enforce: "pre",
          transform(code, id) {
            if (/\/src\/.*\.js$/.test(id)) return transformWithOxc(code, id, { lang: "jsx" });
          },
        }],
        resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
        test: { name: "hydration", environment: "jsdom", include: ["**/*.hydration.test.jsx"] },
      },
    ],
  },
});
