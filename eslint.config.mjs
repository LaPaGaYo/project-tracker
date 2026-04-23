import js from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      ".ccb/**",
      ".git/**",
      ".next/**",
      ".planning/**",
      ".turbo/**",
      ".worktrees/**",
      "coverage/**",
      "dist/**",
      "node_modules/**",
      "public/**",
      "src/**",
      "**/*.vue"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ["apps/**/*.{ts,tsx}", "packages/**/*.ts", "*.config.{js,mjs,ts}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node
      },
      parserOptions: {
        project: "./tsconfig.eslint.json",
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          "prefer": "type-imports"
        }
      ]
    }
  },
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    plugins: {
      "@next/next": nextPlugin
    },
    settings: {
      next: {
        rootDir: "apps/web/"
      }
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules
    }
  },
  eslintConfigPrettier
);
