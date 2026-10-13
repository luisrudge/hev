import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, lazyPlugins, mergeConfig } from "vite-plus";

import reactConfig from "./.agents/skills/react/config/vite";

const worker = `http://localhost:${process.env.WORKER_PORT ?? 1337}`;

export default defineConfig(
  mergeConfig(
    {
      fmt: {
        // The launch video is a timed render; reflowing its HTML can shift frames.
        ignorePatterns: ["video/index.html"],
        sortImports: true,
        sortTailwindcss: {
          attributes: ["class", "className"],
          functions: ["clsx", "cn", "twMerge", "cva"],
          preserveWhitespace: true,
        },
        sortPackageJson: {
          sortScripts: true,
        },
      },
      lint: {
        ignorePatterns: [".agents/skills/**"],
        jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
        rules: {
          curly: "error",
          "vite-plus/prefer-vite-plus-imports": "error",
        },
        options: {
          typeAware: true,
          typeCheck: true,
        },
      },
      staged: {
        "*.{ts,tsx,js,jsx,mjs,json,md,css,html}": "vp check --fix",
      },
      plugins: lazyPlugins(() => [react(), tailwindcss()]),
      server: {
        proxy: { "/v1": worker, "/api": { target: worker, ws: true } },
      },
    },
    reactConfig,
  ),
);
