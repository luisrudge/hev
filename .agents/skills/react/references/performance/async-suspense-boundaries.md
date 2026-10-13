---
title: Strategic Suspense Boundaries
impact: HIGH
impactDescription: faster initial paint
tags: async, suspense, layout-shift
---

## Strategic Suspense Boundaries

Instead of gating the whole page on data, wrap each slow section in its own Suspense boundary so the shell renders immediately while data loads.

In client-rendered React, start fetching outside of render (route loader, event handler, or module-level cache) and unwrap the cached promise with React 19's `use()`. Never create a promise inline during render — an uncached `use(fetchData())` refetches every render and never settles.

**Incorrect (whole page waits for data):**

```tsx
function Page() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetchData().then(setData);
  }, []);

  if (!data) return <Spinner />; // Sidebar, Header, Footer blocked too

  return (
    <div>
      <div>Sidebar</div>
      <div>Header</div>
      <div>
        <DataDisplay data={data} />
      </div>
      <div>Footer</div>
    </div>
  );
}
```

**Correct (shell shows immediately, only the panel waits):**

```tsx
import { Suspense, use } from "react";

// Route loader / module scope — created once per navigation, not during render
const dataPromise = fetchData();

function Page() {
  return (
    <div>
      <div>Sidebar</div>
      <div>Header</div>
      <Suspense fallback={<Skeleton />}>
        <DataDisplay />
      </Suspense>
      <div>Footer</div>
    </div>
  );
}

function DataDisplay() {
  const data = use(dataPromise); // suspends until the promise resolves
  return <div>{data.content}</div>;
}
```

Sidebar, Header, and Footer render immediately. Only DataDisplay waits for data.

**Alternative (share one promise across components):**

Every child can `use()` the same cached promise — the fetch happens once:

```tsx
<Suspense fallback={<Skeleton />}>
  <DataDisplay />
  <DataSummary />
</Suspense>;

function DataSummary() {
  const data = use(dataPromise);
  return <aside>{data.summary}</aside>;
}
```

**Note:** Back promises with a cache keyed by their inputs (re-create when inputs change), or use SWR/react-query's Suspense mode instead of hand-rolling caches — see Client-Side Data Fetching.
