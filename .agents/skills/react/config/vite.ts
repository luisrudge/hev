import { defineConfig } from "vite-plus";

import plugin from "../lint/plugin.js";

const baseRules = [
  "hoist-static-regexp",
  "jsx-no-leaked-and",
  "named-component-props",
  "named-function-args",
  "no-context-provider",
  "no-forward-ref",
  "no-react-hooks-suppression-comments",
  "no-show-props",
  "no-use-context",
  "prefer-functional-setstate",
  "require-passive-scroll-listeners",
  "script-src-needs-defer-or-async",
  "use-state-lazy-init",
] as const;

const customRules = Object.fromEntries(
  baseRules.map((rule) => [`react-skill/${rule}`, "error" as const]),
);

const restrictedBarrels = [
  "lucide-react",
  "@mui/material",
  "@mui/icons-material",
  "@tabler/icons-react",
  "react-icons",
  "@headlessui/react",
  "lodash",
  "ramda",
  "date-fns",
  "rxjs",
  "react-use",
].map((name) => ({
  name,
  message:
    "Import the package's documented direct subpath instead. Skill: react -> references/performance/bundle-barrel-imports.md.",
}));

export default defineConfig({
  lint: {
    plugins: ["react"],
    categories: { correctness: "error" },
    ignorePatterns: [".agents/skills/react/**", ".claude/skills/react/**"],
    jsPlugins: [
      {
        name: "react-skill",
        specifier: "./.agents/skills/react/lint/plugin.js",
      },
    ],
    rules: {
      "react/exhaustive-deps": "error",
      "react/no-unstable-nested-components": "error",
      "react/forward-ref-uses-ref": "off",
      "react/jsx-no-constructed-context-values": "off",
      "react/no-multi-comp": "off",
      "unicorn/no-array-sort": "error",
      "unicorn/no-array-reverse": "error",
      "unicorn/prefer-set-has": "error",
      "no-restricted-imports": ["error", { paths: restrictedBarrels }],
      ...customRules,
    },
    options: { denyWarnings: true },
  },
});
