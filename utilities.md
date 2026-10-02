# `@bearing-agency/utilities`

Written against v1.0.0. If something isn't listed here, check `node_modules/@bearing-agency/utilities/dist/*.d.ts`.

Import from the subpath, e.g. `import { assert } from '@bearing-agency/utilities/assertions'`.

## `assertions`

- `assert(condition, message)` — throws `Error(message)` if falsy; narrows types.
- `assertNever(value, context)` — exhaustiveness check in `switch` defaults.
- `assertSupported(condition, label)` — throws `"<label> is unsupported at this stage"`.

## `arrays`

- `unique(ls)`, `uniqueBy(ls, key)` — first occurrence wins.
- `partition(ls, predicate)` → `[matching, notMatching]`; narrows with type guards.
- `sum(ns)`, `sumBy(items, fn)`
- `min(values)`, `max(values)`, `bounds(values)` → `{ min, max }`; all `null` when empty.
- `minBy(items, fn)`, `maxBy(items, fn)` — skips items whose value is nullish; `null` when none.
- `batch(ls, size)` — split into chunks.
- `range(start, end)` — **inclusive** of `end`.
- `zip(a, b)` — truncates to the shorter array.
- `enumerate(iterable, start = 0)` — yields `[index, item]`.
- `repeat(x, { times })`
- `buildTakeWhileStepper(sortedItems, shouldTake)` — returns `(bound) => items[]`, consuming items in order while `shouldTake(item, bound)`; for walking a sorted list against increasing bounds.

## `maps`

- `buildMapBy(items, getKey)` → `Map<K, T>`. **Duplicate keys: last one silently wins.**
- `groupSum(items, getKey, getValue)` → `Map<K, number>`
- `groupWith(items, getKey, getValue, combine)` — general reduce-by-key.
- `sumInto(map, key, value)` — adds to an existing total (mutates).

## `objects`

- `objectKeys`, `objectEntries`, `objectFromEntries` — typed versions of the `Object.*` builtins.
- `mapObjectValues(obj, fn)`, `filterObjectKeys(obj, pred)`, `filterObjectValues(obj, pred)`
- `pick(obj, keys)`, `omit(obj, keys)`, `omitUndefined(obj)`
- `sortKeys(value)` (deep), `stableStringify(value)` — deterministic JSON, e.g. for comparing/hashing.

## `nullish`

- `isNullish(x)`, `isNotNullish(x)` — type guards; `isNotNullish` is handy in `.filter()`.
- `mapNullish(x, fn)` — `fn(x)`, or `null` if `x` is nullish.
- `nullishDivide(a, b)` — `null` if either is nullish **or `b` is 0**.
- `nullishMultiply(a, b)`

## `results`

`Result<T, E>` = `{ success: true, data } | { success: false, error }` (same shape as Zod's `safeParse`).

- `success(data)`, `failure(error)`
- `mapResult`, `mapError`, `chain` (async)
- `nullishToResult(x, error)`
- `keepSuccesses(results)`, `keepFailures(results)`

## `sort`

- `compareStringAsc(a, b)` — `localeCompare` (after `toString`).
- `compareNumericAsc(a, b)`
- `compareDateStringAsc(a, b)` — plain string comparison, so only correct for ISO-formatted dates.
- `nullsLast(compare)` — wraps a comparator.
- `applyDirection(cmp, 'asc' | 'desc')`
- `withinBounds(value, { min, max })` — inclusive.

## `numbers`

- `roundTo(n, dp)` — `Math.round`-based, so has the usual float issues (e.g. `roundTo(1.005, 2)` is `1`).
- `clamp(n, { min, max })`
- `numberOrNull(value)` — `value` if it's a number, else `null` (doesn't parse strings).

## `strings`

- `plural(word, count)` → `"1 invoice"` / `"3 invoices"` (just appends `s`).
- `oxfordAnd(ls)`, `oxfordOr(ls)` → `"a, b, and c"`
- `truncate(text, length)` — appends `…` when cut.
- `asString(value)` — `toString()`, or `""` for nullish.

## `functions` / `sets`

- `negate(predicate)` — preserves type-guard narrowing.
- `setAdd(set, ...values)`, `setToggle(set, value)`

## `rateLimiter`

- `createRateLimiter({ points, duration /* seconds */ })` → `{ consume(key, points?) }`. In-memory fixed window per key; `consume` **rejects** with `RateLimitedError` (has `msBeforeNext`) rather than waiting.
- `isRateLimitedError(err)`

## Frontend-only

- `classnames`: `cn(...classes)` — clsx + tailwind-merge. Exception: `src/components/ui/` deliberately imports `cn` from shadcn's `cn` package instead, to match what the shadcn CLI generates — don't change those.
- `hooks`: `useOnMount(fn)`
- `ui`: `toOptions(values)` → `{ label, value }[]`
- `files`: `downloadFile(content, filename, mimeType)`, `downloadCsv(rows, columns, filename)`
- `colors`: `withAlpha(color, alpha)`
- `docx`: `docBuilder` (`h1`, `h2`, `p`, `li`, `table`, …), `a4PortraitPage`, `convertMillimetersToPixels` — for generating Word docs with the `docx` package.
