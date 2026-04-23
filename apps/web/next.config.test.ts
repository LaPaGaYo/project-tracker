import path from "node:path";

import { ESLint } from "eslint";
import eslintConfig from "../../eslint.config.mjs";
import nextConfig from "./next.config";
import { describe, expect, it } from "vitest";

describe("next workspace configuration", () => {
  it("pins outputFileTracingRoot to the current worktree root", () => {
    expect(nextConfig.outputFileTracingRoot).toBe(
      path.resolve(import.meta.dirname, "../..")
    );
  });

  it("declares the web app root for the Next ESLint plugin", () => {
    const webConfig = eslintConfig.find((entry) =>
      Array.isArray(entry.files) && entry.files.includes("apps/web/**/*.{ts,tsx}")
    );

    expect(webConfig).toBeDefined();
    expect(webConfig?.settings).toMatchObject({
      next: {
        rootDir: "apps/web/"
      }
    });
  });

  it("applies the Next plugin to the app-local ESLint config file used by next build", async () => {
    const eslint = new ESLint({ cwd: import.meta.dirname });
    const calculated = await eslint.calculateConfigForFile(
      path.join(import.meta.dirname, "eslint.config.mjs")
    );

    expect(calculated).toBeDefined();
    expect(calculated?.plugins).toBeDefined();
    expect("@next/next" in calculated!.plugins).toBe(true);
  });
});
