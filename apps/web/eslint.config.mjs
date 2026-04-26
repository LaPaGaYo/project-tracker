import nextPlugin from "@next/eslint-plugin-next";

import rootConfig from "../../eslint.config.mjs";

export default [
  {
    plugins: {
      "@next/next": nextPlugin
    },
    settings: {
      next: {
        rootDir: "."
      }
    }
  },
  ...rootConfig
];
