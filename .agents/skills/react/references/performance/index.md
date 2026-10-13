# React Best Practices

Performance optimization guide for React applications. Contains 56 rules across
7 categories, prioritized by impact to guide automated refactoring and code
generation.

## React Compiler: always on

Enable the React Compiler in every React project **before** applying any rule in
this skill. It memoizes components, JSX elements, and prop identities at build
time, superseding the manual workarounds this skill previously taught
(`memo()` wrappers, `useMemo`/`useCallback` for referential equality, hoisting
static JSX). Those rules have been removed from this skill — do not reintroduce
them in code either.

**Vite+** (the Oxc React Compiler: `@vitejs/plugin-react` 6.1+ with its
optional `oxc-transform-react` peer). Keep `oxc-transform-react` inside the
plugin's peer range (6.1.x peers `^0.145.0`; newer minors are outside it):

```bash
vp add -D @vitejs/plugin-react@^6.1.0 oxc-transform-react@^0.145.0
```

```ts
// vite.config.ts
import { defineConfig } from "vite-plus";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react({ compiler: true })],
});
```

The bundled Vite+ preset enables React Compiler compatibility checks, hook
checks, and the skill's performance rules as errors. Configure and run it before
manual review using [`../linting.md`](../linting.md).

Reference: [Oxc: Announcing React Compiler Support](https://oxc.rs/blog/2026-08-18-react-compiler-support)

## When to Apply

Reference these guidelines when:

- Writing new React components
- Implementing client-side data fetching
- Reviewing code for performance issues
- Refactoring existing React code
- Optimizing bundle size or load times

## How to Use

This file holds the quick-reference index. Read the matching file in this
directory for detailed explanations and code examples:

| Working on...                         | Read             |
| ------------------------------------- | ---------------- |
| eliminating request waterfalls        | `async-*.md`     |
| shrinking bundles / faster loads      | `bundle-*.md`    |
| client-side data fetching             | `client-*.md`    |
| re-render storms, stale callbacks     | `rerender-*.md`  |
| rendering, hydration, SVG, scripts    | `rendering-*.md` |
| hot loops, lookups, DOM batch edits   | `js-*.md`        |
| scheduling and advanced hook patterns | `advanced-*.md`  |
| Oxlint enforcement                    | `../linting.md`  |

Load more than one when the task spans areas.

Each rule file contains: brief explanation of why it matters, incorrect code
example with explanation, correct code example with explanation, and additional
context.

## Rule Categories by Priority

| Priority | Category                  | Impact      | Prefix       |
| -------- | ------------------------- | ----------- | ------------ |
| 1        | Eliminating Waterfalls    | CRITICAL    | `async-`     |
| 2        | Bundle Size Optimization  | CRITICAL    | `bundle-`    |
| 3        | Client-Side Data Fetching | MEDIUM-HIGH | `client-`    |
| 4        | Re-render Optimization    | MEDIUM      | `rerender-`  |
| 5        | Rendering Performance     | MEDIUM      | `rendering-` |
| 6        | JavaScript Performance    | LOW-MEDIUM  | `js-`        |
| 7        | Advanced Patterns         | LOW         | `advanced-`  |

### 1. Eliminating Waterfalls (CRITICAL)

- `async-cheap-condition-before-await` - Check cheap sync conditions before awaiting flags or remote values
- `async-defer-await` - Move await into branches where actually used
- `async-parallel` - Use Promise.all() for independent operations
- `async-dependencies` - Use better-all for partial dependencies
- `async-api-routes` - Start promises early, await late in request handlers
- `async-suspense-boundaries` - Use Suspense to stream content

### 2. Bundle Size Optimization (CRITICAL)

- `bundle-barrel-imports` - Import directly, avoid barrel files
- `bundle-analyzable-paths` - Prefer statically analyzable import and file-system paths to avoid broad bundles
- `bundle-dynamic-imports` - Use React.lazy for heavy components
- `bundle-defer-third-party` - Load analytics/logging after hydration
- `bundle-conditional` - Load modules only when feature is activated
- `bundle-preload` - Preload on hover/focus for perceived speed

### 3. Client-Side Data Fetching (MEDIUM-HIGH)

- `client-swr-dedup` - Use SWR for automatic request deduplication
- `client-event-listeners` - Deduplicate global event listeners
- `client-passive-event-listeners` - Use passive listeners for scroll
- `client-localstorage-schema` - Version and minimize localStorage data

### 4. Re-render Optimization (MEDIUM)

- `rerender-defer-reads` - Don't subscribe to state only used in callbacks
- `rerender-dependencies` - Use primitive dependencies in effects
- `rerender-derived-state` - Subscribe to derived booleans, not raw values
- `rerender-derived-state-no-effect` - Derive state during render, not effects
- `rerender-functional-setstate` - Use functional setState updates
- `rerender-lazy-state-init` - Pass function to useState for expensive values
- `rerender-split-combined-hooks` - Split hooks with independent dependencies
- `rerender-move-effect-to-event` - Put interaction logic in event handlers
- `rerender-transitions` - Use startTransition for non-urgent updates
- `rerender-use-deferred-value` - Defer expensive renders to keep input responsive
- `rerender-use-ref-transient-values` - Use refs for transient frequent values
- `rerender-no-inline-components` - Don't define components inside components

### 5. Rendering Performance (MEDIUM)

- `rendering-animate-svg-wrapper` - Animate div wrapper, not SVG element
- `rendering-content-visibility` - Use content-visibility for long lists
- `rendering-svg-precision` - Reduce SVG coordinate precision
- `rendering-hydration-no-flicker` - Use inline script for client-only data
- `rendering-hydration-suppress-warning` - Suppress expected mismatches
- `rendering-activity` - Use Activity component for show/hide
- `rendering-conditional-render` - Use ternary, not && for conditionals
- `rendering-usetransition-loading` - Prefer useTransition for loading state
- `rendering-resource-hints` - Use React DOM resource hints for preloading
- `rendering-script-defer-async` - Use defer or async on script tags

### 6. JavaScript Performance (LOW-MEDIUM)

- `js-batch-dom-css` - Group CSS changes via classes or cssText
- `js-index-maps` - Build Map for repeated lookups
- `js-cache-property-access` - Cache object properties in loops
- `js-cache-function-results` - Cache function results in module-level Map
- `js-cache-storage` - Cache localStorage/sessionStorage reads
- `js-combine-iterations` - Combine multiple filter/map into one loop
- `js-length-check-first` - Check array length before expensive comparison
- `js-early-exit` - Return early from functions
- `js-hoist-regexp` - Hoist RegExp creation outside loops
- `js-min-max-loop` - Use loop for min/max instead of sort
- `js-set-map-lookups` - Use Set/Map for O(1) lookups
- `js-tosorted-immutable` - Use toSorted() for immutability
- `js-flatmap-filter` - Use flatMap to map and filter in one pass
- `js-request-idle-callback` - Defer non-critical work to browser idle time

### 7. Advanced Patterns (LOW)

- `advanced-effect-event-deps` - Don't put `useEffectEvent` results in effect deps
- `advanced-event-handler-refs` - Store event handlers in refs
- `advanced-init-once` - Initialize app once per app load
- `advanced-use-latest` - useLatest for stable callback refs

---

Adapted from [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills)
(`react-best-practices`, MIT), with Next.js/React Server Components guidance removed.
