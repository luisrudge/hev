# Oxlint enforcement

The base Vite+ preset enables React Compiler checks, native performance rules,
and the skill's performance and composition rules as errors. It denies warnings.

```ts
import reactConfig from "./.agents/skills/react/config/vite";
import { defineConfig, mergeConfig } from "vite-plus";

export default defineConfig(mergeConfig({/* project config */}, reactConfig));
```

Projects using React's canary `<ViewTransition>` API should merge the optional
preset after the base preset:

```ts
import reactConfig from "./.agents/skills/react/config/vite";
import viewTransitions from "./.agents/skills/react/config/view-transitions";
import { defineConfig, mergeConfig } from "vite-plus";

export default defineConfig(
  mergeConfig(mergeConfig({/* project config */}, reactConfig), viewTransitions),
);
```

Run lint before manual review and after making changes:

```bash
vp lint
```

Fix every diagnostic before applying judgment-based guidance. The custom rules
are diagnostic-only and do not provide autofixes.

## Native checks

The base preset enables the React plugin and Oxlint's correctness category,
which turns on the recommended React Compiler rules. There is no
`react/react-compiler` umbrella — do not set that name.

It also enables these explicit native rules:

| Rule                                  | Enforces                                      |
| ------------------------------------- | --------------------------------------------- |
| `react/exhaustive-deps`               | Complete hook dependency arrays.              |
| `react/no-unstable-nested-components` | Stable component definitions.                 |
| `unicorn/no-array-sort`               | Immutable sorting with `toSorted()`.          |
| `unicorn/no-array-reverse`            | Immutable reversal with `toReversed()`.       |
| `unicorn/prefer-set-has`              | Sets for repeated membership checks.          |
| `no-restricted-imports`               | Direct imports from configured large barrels. |

## Performance

| Rule                                              | Enforces                                                            |
| ------------------------------------------------- | ------------------------------------------------------------------- |
| `react-skill/no-react-hooks-suppression-comments` | No disable comments for `react-hooks` rules.                        |
| `react-skill/jsx-no-leaked-and`                   | Numeric values cannot leak through JSX `&&`.                        |
| `react-skill/use-state-lazy-init`                 | Expensive state initialization runs once.                           |
| `react-skill/prefer-functional-setstate`          | State-dependent setters use functional updates.                     |
| `react-skill/require-passive-scroll-listeners`    | Touch and wheel listeners are passive unless they cancel the event. |
| `react-skill/hoist-static-regexp`                 | Static regular expressions are not recreated in renders or loops.   |
| `react-skill/script-src-needs-defer-or-async`     | External scripts do not block parsing.                              |

## Composition and React 19

| Rule                                | Enforces                                                        |
| ----------------------------------- | --------------------------------------------------------------- |
| `react-skill/named-component-props` | Named props types instead of inline object types on components. |
| `react-skill/named-function-args`   | Named `Args` types for destructured function parameters.        |
| `react-skill/no-forward-ref`        | React 19 ref props instead of `forwardRef`.                     |
| `react-skill/no-context-provider`   | `<Context value>` instead of `<Context.Provider>`.              |
| `react-skill/no-use-context`        | React 19 `use(Context)` instead of `useContext`.                |
| `react-skill/no-show-props`         | Composition, slots, or variants instead of `showX` props.       |

## View Transitions

| Rule                                                           | Enforces                                                             |
| -------------------------------------------------------------- | -------------------------------------------------------------------- |
| `react-skill/no-document-start-view-transition`                | React owns browser transition calls.                                 |
| `react-skill/require-type-map-default-none`                    | Type maps use `default: "none"`.                                     |
| `react-skill/require-default-none-on-type-keyed-vt`            | Type-keyed components use `default="none"`.                          |
| `react-skill/no-type-map-on-suspense-reveal`                   | Suspense reveals use string classes, not type maps.                  |
| `react-skill/no-dom-parent-of-enter-exit-vt`                   | Enter/exit transitions appear before intrinsic DOM nodes.            |
| `react-skill/require-paired-type-map-enter-exit`               | Type-map enter and exit definitions are paired.                      |
| `react-skill/no-manual-name-on-vt-child`                       | React's generated child transition name is not overridden.           |
| `react-skill/no-direct-add-transition-type-outside-transition` | Direct event-handler type additions occur inside a React transition. |
| `react-skill/no-typed-router-back`                             | Typed navigation uses an explicit URL instead of history back.       |

Suppress a legitimate exception narrowly and include the reason:

```ts
// oxlint-disable-next-line react-skill/no-show-props -- third-party component API
```
