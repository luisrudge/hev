---
title: Defer Non-Critical Third-Party Libraries
impact: MEDIUM
impactDescription: loads after hydration
tags: bundle, third-party, analytics, defer
---

## Defer Non-Critical Third-Party Libraries

Analytics, logging, and error tracking don't block user interaction. Load them after hydration.

**Incorrect (blocks initial bundle):**

```tsx
import { Analytics } from "./analytics";

export default function App() {
  return (
    <main>
      {children}
      <Analytics />
    </main>
  );
}
```

**Correct (loads after hydration):**

```tsx
import { lazy, Suspense } from "react";

const Analytics = lazy(() => import("./analytics").then((m) => ({ default: m.Analytics })));

function DeferredAnalytics() {
  return (
    <Suspense fallback={null}>
      <Analytics />
    </Suspense>
  );
}

export default function App() {
  return (
    <main>
      {children}
      <DeferredAnalytics />
    </main>
  );
}
```
