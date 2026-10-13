---
title: Use Functional setState Updates
impact: MEDIUM
impactDescription: prevents lost updates under batching
tags: react, hooks, useState, callbacks, closures
---

## Use Functional setState Updates

When updating state based on the current state value, use the functional update form of setState (`setX(curr => ...)`) instead of reading the state variable from the closure. Multiple updates queued in the same tick (batched handlers, async flows) all read the same closed-over value — each functional update receives the latest queued state instead.

**Incorrect (reads closure value — lost updates when updates batch):**

```tsx
function TodoList() {
  const [items, setItems] = useState(initialItems);

  const addItems = (newItems: Item[]) => {
    setItems([...items, ...newItems]);
  };

  return <ItemsEditor items={items} onAdd={addItems} />;
}
```

If two updates fire in the same tick (`addItems(a)` then `addItems(b)`), both compute from the same stale `items`, so the first update is overwritten.

**Correct (always operates on the latest queued state):**

```tsx
function TodoList() {
  const [items, setItems] = useState(initialItems);

  const addItems = (newItems: Item[]) => {
    setItems((curr) => [...curr, ...newItems]);
  };

  return <ItemsEditor items={items} onAdd={addItems} />;
}
```

**Benefits:**

1. **No lost updates** - Correct under batching, StrictMode double-invocation, and concurrent rendering
2. **No stale closures** - Always operates on the latest state value

**When to use functional updates:**

- Any setState that depends on the current state value
- Async operations that update state after a delay
- Multiple updates queued within one tick

**When direct updates are fine:**

- Setting state to a static value: `setCount(0)`
- Setting state from props/arguments only: `setName(newName)`
- State doesn't depend on previous value

**Note:** With the React Compiler enabled there is no performance dimension to callback identity or dependency bookkeeping — write plain handler functions and choose whichever form is correct.
