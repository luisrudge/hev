---
title: Split Combined Hooks
impact: MEDIUM
impactDescription: avoids running unrelated logic together
tags: rerender, useEffect, dependencies
---

## Split Combined Hooks

When a hook contains multiple independent tasks, split them into separate hooks so unrelated changes don't trigger unrelated work.

For derived values, write each derivation as its own plain `const` — the React Compiler memoizes every expression on its exact inputs automatically, so `filteredProducts` doesn't recompute when only an unrelated `sortOrder` changes. Manual `useMemo` splitting is obsolete; do not hand-write it.

The rule remains critical for `useEffect`, where the compiler does not help:

**Incorrect (both effects run when either dependency changes):**

```tsx
useEffect(() => {
  analytics.trackPageView(pathname);
  document.title = `${pageTitle} | My App`;
}, [pathname, pageTitle]);
```

**Correct (effects run independently):**

```tsx
useEffect(() => {
  analytics.trackPageView(pathname);
}, [pathname]);

useEffect(() => {
  document.title = `${pageTitle} | My App`;
}, [pageTitle]);
```

Changing `pathname` no longer re-runs the title effect and vice versa.
