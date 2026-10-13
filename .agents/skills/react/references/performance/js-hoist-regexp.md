---
title: Hoist RegExp Creation
impact: LOW-MEDIUM
impactDescription: avoids recreation
tags: javascript, regexp, optimization
---

## Hoist RegExp Creation

Hoist static RegExp patterns to module scope — creating them inside render on every render is wasted work. Patterns built from dynamic values (props/state) are fine inline: the React Compiler memoizes their construction automatically.

**Incorrect (recreates a constant pattern every render):**

```tsx
function EmailField({ value }: Props) {
  // Static pattern — identical on every render
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return <input value={value} pattern={emailRegex.source} />;
}
```

**Correct (static patterns live at module scope; dynamic patterns stay inline):**

```tsx
// Created once at module load
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function EmailField({ value }: Props) {
  return <input value={value} pattern={EMAIL_REGEX.source} />
}

function Highlighter({ text, query }: Props) {
  // Dynamic pattern — fine inline; compiler caches it per distinct query
  const regex = new RegExp(`(${escapeRegex(query)})`, 'gi')
  const parts = text.split(regex)
  return <>{parts.map((part, i) => ...)}</>
}
```

**Warning (global regex has mutable state):**

Global regex (`/g`) has mutable `lastIndex` state:

```typescript
const regex = /foo/g;
regex.test("foo"); // true, lastIndex = 3
regex.test("foo"); // false, lastIndex = 0
```
