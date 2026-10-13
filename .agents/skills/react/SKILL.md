---
name: react
description: React 19 guidance covering performance, composition, and View Transitions. Use when writing, reviewing, or refactoring React components; designing component APIs; optimizing rendering and bundles; or implementing React View Transitions.
---

# React

Use React 19 with the React Compiler enabled. This skill combines performance,
component composition, and optional canary View Transition guidance under one
set of references and Oxlint rules.

## Workflow

1. Enable the base preset from `references/linting.md`. Add the optional View
   Transition preset only for projects using `react@canary`.
2. Run the project's `vp lint` command before manual review and after changes.
3. Fix every diagnostic, following the reference path in its message. Do not
   repeat deterministic checks manually.
4. Read the matching section for design and performance decisions lint cannot
   make:

| Working on                                                                 | Read                                   |
| -------------------------------------------------------------------------- | -------------------------------------- |
| rendering, hooks, data fetching, bundles, or JavaScript performance        | `references/performance/index.md`      |
| component APIs, boolean props, providers, variants, or React 19 migrations | `references/composition/index.md`      |
| shared elements, route animation, Suspense reveals, or transition types    | `references/view-transitions/index.md` |
| Oxlint setup and rule inventory                                            | `references/linting.md`                |

Load more than one section when the task crosses these concerns.

## Baseline

- Enable the React Compiler before applying manual performance changes.
- Prefer composition, slots, variants, or compound components over `showX` props.
- Prefer named props types for components, and `Args`-suffixed types for destructured function parameters.
- Do not disable `react-hooks/exhaustive-deps` or `react-hooks/rules-of-hooks`; those comments also opt the function out of the React Compiler.
- Use React 19 ref and context APIs.
- View Transitions require `react@canary` and the optional View Transition lint preset.
- Treat every bundled lint rule as an error. Suppress only the exact line with a reason.
