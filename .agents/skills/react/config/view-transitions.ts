import { defineConfig } from "vite-plus";

const rules = [
  "no-direct-add-transition-type-outside-transition",
  "no-document-start-view-transition",
  "no-dom-parent-of-enter-exit-vt",
  "no-manual-name-on-vt-child",
  "no-type-map-on-suspense-reveal",
  "no-typed-router-back",
  "require-default-none-on-type-keyed-vt",
  "require-paired-type-map-enter-exit",
  "require-type-map-default-none",
] as const;

export default defineConfig({
  lint: {
    rules: Object.fromEntries(rules.map((rule) => [`react-skill/${rule}`, "error" as const])),
  },
});
