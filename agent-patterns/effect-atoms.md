# Effect Atom Patterns

Use this when writing or changing code that uses Effect's unstable atom
reactivity APIs. The source of truth reviewed for these patterns is the vendored
Effect repo: `@repos/effect/LLMS.md`,
`@repos/effect/packages/effect/src/unstable/reactivity/Atom.ts`,
`AtomRegistry.ts`, `AsyncResult.ts`, `Reactivity.ts`, `Hydration.ts`,
`AtomHttpApi.ts`, `AtomRpc.ts`, and the tests in
`@repos/effect/packages/effect/test/reactivity`.

## Imports

Import atom APIs from the unstable reactivity barrel.

```ts
import { Effect, Layer, Schema, Stream } from "effect"
import { AsyncResult, Atom, AtomRegistry, Hydration } from "effect/unstable/reactivity"
```

## Registry Owns State

An `Atom` is a value description. An `AtomRegistry` owns cached values,
dependency edges, subscriptions, running fibers, stream scopes, and disposal.
Use one registry per isolated lifetime: UI root, request, route boundary, or
test.

```ts
const count = Atom.make(0)
const doubled = Atom.make((get) => get(count) * 2)

const registry = AtomRegistry.make()
registry.set(count, 21)
registry.get(doubled) // 42
```

The same atom object can have different values in different registries. After
`registry.dispose()`, later atom access is an error.

## Keep Atom Identity Stable

Do not create parameterized atoms inline during reads or renders. Atom identity
is the cache key unless the atom is serializable. Use `Atom.family` for
parameterized atoms so the same input returns the same atom object.

```ts
const userAtom = Atom.family((id: string) =>
  UserClient.runtime.atom(UserClient.use((client) => client.getUser({ id }))).pipe(
    Atom.withLabel(`user:${id}`)
  )
)
```

Use `Atom.withLabel` on important atoms. It only adds diagnostic metadata and
does not change behavior.

## Choose The Right Constructor

Use `Atom.make(value)` for writable local state, `Atom.make((get) => value)` for
derived synchronous state, and `Atom.make(effectOrStream)` for read atoms that
produce `AsyncResult`.

```ts
const search = Atom.make("")

const trimmedSearch = Atom.make((get) => get(search).trim())

const users = Atom.make((get) =>
  Effect.gen(function*() {
    const query = get(trimmedSearch)
    return yield* UserApi.use((api) => api.search(query))
  })
)
```

Use `Atom.fn` for command-style effects that run when written to. Use
`Atom.fnSync` for synchronous commands. Before the first write, `Atom.fn`
returns `AsyncResult.initial()` unless `initialValue` is supplied, and
`Atom.fnSync` returns `Option.none()` unless `initialValue` is supplied.

```ts
const saveUser = Atom.fn<{ readonly id: string; readonly name: string }>()(
  Effect.fn("saveUser")(function*(input) {
    return yield* UserApi.use((api) => api.save(input))
  })
)

registry.set(saveUser, { id: "1", name: "Ada" })
```

Write `Atom.Reset` to clear an `Atom.fn` result back to its initial state and
`Atom.Interrupt` to interrupt the current computation. Set `{ concurrent: true }`
only when multiple writes should run at the same time; the default interrupts
and replaces the previous run.

## Read Dependencies Deliberately

Inside an atom read, `get(atom)` records a dependency. When that dependency
changes, the current atom is invalidated. Use `get.once(atom)` when you need the
current value without creating a dependency edge.

Use `get.result(asyncAtom)` to await an `AsyncResult` atom from another effect
atom. It waits while the result is `Initial`; pass `{ suspendOnWaiting: true }`
when stale values marked `waiting` should also suspend.

```ts
const enrichedUser = Atom.make((get) =>
  Effect.gen(function*() {
    const user = yield* get.result(userAtom("1"), { suspendOnWaiting: true })
    return { ...user, displayName: user.name.toUpperCase() }
  })
)
```

In `Atom.fn` bodies, `get.result` behaves as a one-shot wait instead of a normal
dependency read. If the command should rerun from another atom changing, read
that atom with `get(atom)` as part of the command trigger or use reactivity keys.

## Handle AsyncResult As State

`AsyncResult` has three variants: `Initial`, `Success`, and `Failure`. The
`waiting` flag is an overlay, not a fourth variant. A waiting success or failure
can still contain the previous usable value.

Prefer `AsyncResult.matchWithWaiting`, `AsyncResult.builder`, or explicit
refinements instead of assuming any non-success is a loading state.

```ts
const view = AsyncResult.matchWithWaiting(result, {
  onWaiting: () => "Loading",
  onSuccess: ({ value }) => value.name,
  onError: (error) => `Error: ${String(error)}`,
  onDefect: () => "Unexpected error"
})
```

`AsyncResult.value(result)` and `AsyncResult.getOrElse(result, fallback)` may
return a previous success stored inside a failure. Inspect
`AsyncResult.cause(result)` or `AsyncResult.error(result)` when current failure
versus stale data matters.

## Manage Lifetime Explicitly

Unobserved atoms are auto-disposed by default. That means local state can reset,
effects can restart, streams can resubscribe, and finalizers can run after the
last listener or dependent child disappears.

Use the narrowest lifetime tool that matches the behavior:

- `Atom.keepAlive` keeps an atom cached even when unobserved.
- `Atom.setIdleTTL(duration)` keeps an unused atom around for a finite idle time.
- `Atom.autoDispose` restores default disposal on a copied atom.
- `registry.mount(atom)` keeps an atom alive until the returned release function
  is called.
- `Atom.mount(atom)` keeps an atom alive for the current Effect scope.

Always release `registry.subscribe` and `registry.mount` callbacks when
integrating with external callback-based code.

## Batch Related Writes

Use `Atom.batch` when multiple synchronous writes should invalidate dependents
and notify listeners once after the final state is known.

```ts
Atom.batch(() => {
  registry.set(firstName, "Ada")
  registry.set(lastName, "Lovelace")
})
```

Reads inside a batch can still rebuild from the latest written state, but
listeners are notified after the batch commits.

## Use Runtime Atoms For Services

Use `Atom.runtime(layer)` or `Atom.context({ memoMap })` when atom effects need
Effect services. The runtime builds the layer with a memo map, provides
`AtomRegistry`, `Scope`, `Scheduler`, and `Reactivity`, and exposes
`runtime.atom`, `runtime.fn`, `runtime.pull`, and `runtime.subscriptionRef`.

```ts
const UserRuntime = Atom.runtime(UserApi.layer)

const user = Atom.family((id: string) =>
  UserRuntime.atom(UserApi.use((api) => api.getUser(id)), {
    initialValue: { id, name: "Loading" }
  })
)

const saveUser = UserRuntime.fn(
  Effect.fn("saveUser")(function*(input: User) {
    return yield* UserApi.use((api) => api.saveUser(input))
  }),
  { reactivityKeys: { users: [] } }
)
```

Use registry `initialValues` with `Atom.initialValue(runtime.layer, testLayer)`
to replace runtime services in tests.

## Invalidate Server State With Reactivity Keys

Use `Atom.withReactivity(keys)` for reads that should refresh after matching
invalidations. Use `runtime.fn(..., { reactivityKeys })`,
`Reactivity.mutation(effect, keys)`, or `Reactivity.invalidate(keys)` for writes
that should trigger those refreshes after success.

Keys can be a flat array or a record. Prefer stable primitive keys or stable ids;
non-primitive keys are matched by `Hash.hash`.

```ts
const user = UserRuntime.atom(UserApi.use((api) => api.getUser("1"))).pipe(
  UserRuntime.factory.withReactivity({ users: ["1"] })
)

const saveUser = UserRuntime.fn(
  (input: User) => UserApi.use((api) => api.saveUser(input)),
  { reactivityKeys: { users: ["1"] } }
)
```

## Streams, Pulls, And SubscriptionRefs

An `Atom.make(stream)` stores the latest emitted item in an `AsyncResult`. An
empty stream completes as `NoSuchElementError`. Failures preserve the latest
previous success when possible.

Use `Atom.pull(stream)` or `runtime.pull(stream)` for paginated or incremental
streams that should advance only when the atom is written to. It accumulates
items by default; pass `{ disableAccumulation: true }` when each pull should
replace the previous batch.

Use `Atom.subscriptionRef(refOrEffect)` when state already lives in a
`SubscriptionRef`; writes to the atom update the ref.

## Persistence And Hydration

Mark atoms that cross registry boundaries with `Atom.serializable({ key,
schema })`. Only serializable atoms are included in `Hydration.dehydrate`, and
`Hydration.hydrate` must run before the matching atoms are first read.

```ts
const user = userAtom("1").pipe(
  Atom.serializable({
    key: "user:1",
    schema: AsyncResult.Schema({
      success: User,
      error: UserError
    })
  })
)

const state = Hydration.dehydrate(serverRegistry)
Hydration.hydrate(clientRegistry, state)
```

Stable keys matter more than atom identity during hydration. The target atom must
use a compatible schema. `Hydration.dehydrate(..., { encodeInitialAs: "promise" })`
uses a live JavaScript promise for initial async results, so do not serialize
that form across JSON or processes.

For browser URL state, `Atom.searchParam` requires synchronous schemas with no
Effect context. For storage-backed state, use `Atom.kvs` with an atom runtime
that provides `KeyValueStore`.

## Remote API Helpers

Use `AtomHttpApi.Service` or `AtomRpc.Service` when typed HTTP API or RPC
clients should participate in atom caching, invalidation, and hydration.

- Queries return `Atom<AsyncResult<...>>` for non-streaming endpoints.
- Mutations return `AtomResultFn`.
- `reactivityKeys` connect successful mutations to query refreshes.
- `timeToLive` maps to `Atom.setIdleTTL` for finite durations and
  `Atom.keepAlive` for infinite durations.
- `serializationKey` is required for serializable queries, and should uniquely
  identify the endpoint plus request.
- RPC streaming queries return pull atoms and are not serializable query atoms.

## Testing Patterns

Use `it.effect` for Effect-based tests, `AtomRegistry.make()` for an isolated
cache, fake timers or `TestClock` for delayed atoms, and explicit
`registry.mount(atom)` when async work must stay alive during the test.

```ts
it.effect("refreshes after mutation", () =>
  Effect.gen(function*() {
    const registry = AtomRegistry.make()
    const unmount = registry.mount(user)

    registry.set(saveUser, { id: "1", name: "Grace" })
    yield* Effect.yieldNow

    const result = registry.get(user)
    assert(AsyncResult.isSuccess(result))
    assert.strictEqual(result.value.name, "Grace")

    unmount()
  }))
```

Prefer `yield* Effect.yieldNow`, fake timer advancement, or `TestClock` over
real sleeps. Assert `AsyncResult` variants and `waiting` flags directly. For
lifetime behavior, assert node disposal by reading again after yielding, or use
`keepAlive` / `mount` when state should persist.
