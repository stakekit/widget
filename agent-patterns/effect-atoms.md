# Effect Atom Patterns

Use this guide for Effect's unstable reactivity APIs: local state, derived
state, async resources, mutations, pagination, invalidation, persistence, and
hydration.

The source of truth is the vendored Effect repository, especially:

- `@repos/effect/packages/effect/src/unstable/reactivity/Atom.ts`
- `@repos/effect/packages/effect/src/unstable/reactivity/AtomRegistry.ts`
- `@repos/effect/packages/effect/src/unstable/reactivity/AsyncResult.ts`
- `@repos/effect/packages/effect/src/unstable/reactivity/Reactivity.ts`
- `@repos/effect/packages/effect/src/unstable/reactivity/Hydration.ts`
- `@repos/effect/packages/effect/src/unstable/reactivity/AtomHttpApi.ts`
- `@repos/effect/packages/effect/src/unstable/reactivity/AtomRpc.ts`
- `@repos/effect/packages/effect/test/reactivity`

## Imports

Match nearby code. The reactivity barrel is convenient when several modules are
used together; module imports are useful for namespace-style or type-only
imports.

```ts
import { Effect, Option, Schema, Stream } from "effect"
import {
  AsyncResult,
  Atom,
  AtomRegistry,
  Hydration
} from "effect/unstable/reactivity"
```

## Mental Model

An `Atom` is a stable description of how to read or write a value. An
`AtomRegistry` owns the mutable runtime state:

- cached values and serializable preloads
- parent/child dependency edges
- subscriptions and mounted nodes
- running fibers, stream scopes, and finalizers
- idle timers and disposal

The same atom can hold different values in different registries. Use one
registry per isolated lifetime, such as a UI root or test. Prefer
`AtomRegistry.layer` when an Effect scope owns that lifetime; its finalizer
disposes the registry.

```ts
const count = Atom.make(0)
const doubled = Atom.make((get) => get(count) * 2)

const registry = AtomRegistry.make()
registry.set(count, 21)
registry.get(doubled) // 42
```

A bare `registry.get(atom)` does not mount the atom. An unobserved node is
eligible for disposal on a later scheduler turn. This matters for async work:
mount or subscribe when the computation must remain alive.

After `registry.dispose()`, creating or accessing nodes throws. `reset()` clears
nodes but leaves the registry reusable; `dispose()` is terminal.

## Choose The Right Shape

| Need | API | Exposed value |
| --- | --- | --- |
| Writable local state | `Atom.make(initial)` | `A` |
| Synchronous derivation | `Atom.make((get) => value)` | `A` |
| Async or stream resource | `Atom.make(effectOrStream)` | `AsyncResult<A, E>` |
| Synchronous command | `Atom.fnSync` | `Option<A>` or configured initial `A` |
| Async command/mutation | `Atom.fn` | `AsyncResult<A, E>` |
| Incremental page/chunk loading | `Atom.pull` | `PullResult<A, E>` |
| Existing mutable Effect state | `Atom.subscriptionRef` | writable resource atom |
| Parameterized atom | `Atom.family` | same shape returned by the family |

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

Use `Atom.fn` for work that starts only when a value is written. Before the
first write it is `AsyncResult.initial()` unless `initialValue` is supplied.
The default latest write wins: refreshing the command atom disposes its prior
lifetime and interrupts its computation.

```ts
const saveUser = Atom.fn<{
  readonly id: string
  readonly name: string
}>()(Effect.fn("saveUser")(function*(input) {
  return yield* UserApi.use((api) => api.save(input))
}))

registry.set(saveUser, { id: "1", name: "Ada" })
```

Write `Atom.Reset` to restore the initial command state and `Atom.Interrupt` to
interrupt the active computation. Use `{ concurrent: true }` only when writes
may overlap and a single shared result atom is still the correct interface. If
callers need individually correlated results, model the operation as a normal
Effect instead.

## Keep Identity Stable

Registry caching normally uses atom identity. Do not create parameterized atoms
inline during reads or React renders. Use `Atom.family` so equal inputs return
the same live atom object.

```ts
const userAtom = Atom.family((id: string) =>
  UserRuntime.atom(
    UserApi.use((api) => api.getUser(id))
  ).pipe(Atom.withLabel(`user:${id}`))
)
```

`Atom.family` uses Effect hashing/equality and weakly holds produced objects when
the platform supports `WeakRef`. Prefer primitive ids or immutable Effect data
as family keys; mutating an object used as a hashed key breaks lookup
assumptions.

Serializable atoms are different: their serialization key becomes the registry
key. Two atom objects with the same serializable key alias the same registry
node. Keys must therefore be unique and their schemas compatible throughout one
registry.

Use `Atom.withLabel` on important atoms for diagnostics. It does not change
runtime behavior.

## Read Dependencies Deliberately

In a normal atom read:

- `get(atom)` or `get.get(atom)` records a dependency.
- `get.once(atom)` reads without a dependency edge.
- `get.result(asyncAtom)` records a dependency and suspends the current atom
  effect while the result is `Initial`.
- `get.resultOnce(asyncAtom)` waits once without making it a reactive
  dependency.

Pass `{ suspendOnWaiting: true }` when stale values marked `waiting` must also
suspend.

```ts
const enrichedUser = Atom.make((get) =>
  Effect.gen(function*() {
    const user = yield* get.result(userAtom("1"), {
      suspendOnWaiting: true
    })
    return { ...user, displayName: user.name.toUpperCase() }
  })
)
```

`Atom.fn` and `Atom.fnSync` are commands, not reactive derivations. Reads through
their `FnContext` are one-shot and do **not** add dependency edges. A command
reruns only when written again. Use a normal derived atom when work should rerun
because another atom changed, or pass the current value as part of the command
input.

Use `get.subscribe`, `get.mount`, and `get.addFinalizer` only for explicit
lifecycle integration. Their cleanup is tied to the current atom lifetime.

## Treat AsyncResult As A State Machine

`AsyncResult` has three variants: `Initial`, `Success`, and `Failure`. The
`waiting` flag is an overlay, not a fourth variant. A waiting success or failure
can retain useful stale data while a refresh runs.

Prefer `AsyncResult.matchWithWaiting`, `AsyncResult.builder`, or explicit
refinements instead of equating every non-success with loading.

```ts
const view = AsyncResult.matchWithWaiting(result, {
  onWaiting: () => "Loading",
  onSuccess: ({ value }) => value.name,
  onError: (error) => `Error: ${String(error)}`,
  onDefect: () => "Unexpected error"
})
```

`AsyncResult.value(result)` and `AsyncResult.getOrElse(result, fallback)` can
return a previous success stored inside a failure. This is useful for keeping
already loaded pages or stale server data visible. Inspect
`AsyncResult.cause(result)` or `AsyncResult.error(result)` when the current
failure must be shown separately from the fallback value.

Do not drop the `waiting` flag when mapping UI state. It is the signal that a
displayed success or failure is stale and a new computation is active.

## Make Lifetime A Product Decision

Unobserved atoms auto-dispose by default. Disposal can reset local state,
interrupt effects, close stream scopes, remove subscriptions, and run
finalizers.

Use the narrowest lifetime tool that matches the requirement:

- `registry.subscribe(atom, listener)` observes until its release callback runs.
- `registry.mount(atom)` keeps it alive until its release callback runs.
- `Atom.mount(atom)` keeps it alive for the current Effect scope.
- `Atom.setIdleTTL(duration)` retains it for a finite unobserved interval.
- `Atom.keepAlive` retains it for the entire registry lifetime.
- `Atom.autoDispose` removes a copied atom's `keepAlive` behavior.

Always release registry subscriptions and mounts. Be especially careful with a
high-cardinality `Atom.family`: combining it with `keepAlive` or a long TTL can
turn a weak family into an effectively unbounded registry cache.

Registry `initialValues` seed a node but do not mount it. The seeded value is
still subject to normal disposal and recomputation.

## Batch Related Synchronous Writes

Use `Atom.batch` when several synchronous writes form one logical state change.
Dependents can rebuild from the latest values inside the batch, but listeners
are notified after the outermost batch commits.

```ts
Atom.batch(() => {
  registry.set(firstName, "Ada")
  registry.set(lastName, "Lovelace")
})
```

`Atom.batch` is not an Effect transaction and does not wait for async work. Use
it only around synchronous registry operations.

## Use Runtime Atoms For Services

Plain async atoms may require only `Scope` and `AtomRegistry`. Use an atom
runtime when effects also require application services.

```ts
const UserRuntime = Atom.runtime(UserApi.layer)

const user = Atom.family((id: string) =>
  UserRuntime.atom(
    UserApi.use((api) => api.getUser(id))
  )
)

const saveUser = UserRuntime.fn(
  Effect.fn("saveUser")(function*(input: User) {
    return yield* UserApi.use((api) => api.saveUser(input))
  }),
  { reactivityKeys: { users: [] } }
)
```

`Atom.runtime(layer)` uses the default shared `Layer.MemoMap`.
`Atom.context({ memoMap })` creates a factory with an explicit memoization
boundary and exposes `addGlobalLayer`. The runtime supplies `AtomRegistry`,
`Scope`, `Scheduler`, and `Reactivity` while building its layer.

In tests, replace a runtime layer with registry initial values:

```ts
const registry = AtomRegistry.make({
  initialValues: [
    Atom.initialValue(UserRuntime.layer, UserApi.testLayer)
  ]
})
```

Mount the resource under test so the seeded runtime and async work are not
disposed between assertions.

## Model Server Resources With SWR And TTL

`Atom.swr` adds stale-while-revalidate behavior to an `AsyncResult` atom.
`staleTime` controls freshness; `revalidateOnMount` and `revalidateOnFocus`
control automatic refresh triggers.

```ts
const usersResource = UserRuntime.atom(
  UserApi.use((api) => api.listUsers())
).pipe(
  Atom.swr({
    staleTime: "30 seconds",
    revalidateOnMount: true,
    revalidateOnFocus: true,
    focusSignal: appFocusSignal
  }),
  Atom.setIdleTTL("5 minutes")
)
```

Important details:

- A manual registry refresh is forceful even while data is fresh.
- A stale success or failure keeps its previous success while revalidation
  runs.
- Focus revalidation requires both `revalidateOnFocus` and a `focusSignal`.
- `true` respects `staleTime`; `"always"` forces a refresh on every signal.
- Freshness uses `AsyncResult` timestamps and host `Date.now`.

Apply resource policy combinators before `Atom.serializable`. Transforming an
atom can intentionally remove its serializable marker; serialize the final
public resource that should cross registries.

## Invalidate Server State With Reactivity Keys

Attach keys to reads with `Atom.withReactivity` or
`runtime.factory.withReactivity`. Invalidate them through
`runtime.fn(..., { reactivityKeys })`, `Reactivity.mutation`, or
`Reactivity.invalidate`.

```ts
const user = UserRuntime.atom(
  UserApi.use((api) => api.getUser("1"))
).pipe(
  UserRuntime.factory.withReactivity({ users: ["1"] })
)
```

Key matching is hash based, not deep structural matching. Prefer primitives or
immutable Effect data. Record keys have hierarchical behavior:
`{ users: ["1"] }` registers both `"users"` and `"users:1"`. Consequently,
two records with the same `users` group overlap even when their ids differ. Use
a flat composite key such as `["users:1"]` when invalidation must be strictly
per id.

`Reactivity.mutation(effect, keys)` invalidates only after an Effect succeeds.
A stream-returning runtime command uses stream finalization to invalidate, so it
also invalidates when that stream ends through failure or interruption. Choose
the command shape with that distinction in mind.

## Streams, Pulls, And SubscriptionRefs

`Atom.make(stream)` subscribes while the atom is alive and stores the latest
emitted item as an `AsyncResult`. A stream that completes without emitting fails
with `NoSuchElementError`. A later failure preserves a previous success when one
exists.

Use `Atom.pull` for demand-driven pagination. The first chunk is pulled when the
atom is read; each write requests another chunk.

```ts
const pages = Atom.pull(
  Stream.paginate(initialCursor, fetchPage)
)
```

With default accumulation, the success value contains `{ items, done }` and
`done` becomes true after the terminal pull. Pass
`{ disableAccumulation: true }` when each pull should replace the prior batch or
when retaining the entire history would be too expensive. In that mode, a
terminal pull with no new items can surface `NoSuchElementError` instead of a
final accumulated `{ done: true }` value. Avoid issuing another write while the
pull result is already waiting unless overlapping pulls are intentional.

Use `Atom.subscriptionRef(refOrEffect)` when state already lives in a
`SubscriptionRef`; atom writes update the ref.

## Persistence And Hydration

Mark only state that crosses registry boundaries as serializable.

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

Hydrate before the target atom is first read. Hydration preloads encoded values
by key; it does not replace an already-built node. Serialization uses
synchronous JSON codecs, so schemas must not require Effect services.

`dehydrate` ignores `AsyncResult.Initial` by default. The other modes are:

- `"value-only"` encodes the initial value itself.
- `"promise"` includes a live promise that later updates the target registry.

The promise mode is process-local JavaScript state. Do not JSON-serialize it or
send it across a network/process boundary.

For browser URL state, `Atom.searchParam` requires a synchronous schema with no
context. For storage state, use `Atom.kvs` with a runtime providing
`KeyValueStore`.

## Remote API Helpers

Use `AtomHttpApi.Service` or `AtomRpc.Service` when a typed HTTP API or RPC
client should participate directly in atom caching and invalidation.

- Non-streaming queries return `Atom<AsyncResult<...>>`.
- Mutations return `AtomResultFn`.
- `reactivityKeys` connect commands to query refreshes.
- `timeToLive` maps finite values to idle TTL and infinity to `keepAlive`.
- Serializable queries require a unique `serializationKey` per endpoint and
  request.
- Streaming RPC queries return pull atoms and are not serializable query atoms.

Prefer the project's generated client plus hand-written transport/service layer
when those helpers would duplicate existing abstractions.

## Testing

Create a fresh registry per test and dispose it or release every mount. Test the
state machine, not only the final success:

- initial and waiting state
- stale success during refresh
- failure with and without previous success
- interruption or latest-write-wins behavior
- finalizers and disposal
- pagination completion and accumulated items

Use regular Vitest tests for purely imperative registry logic. Run effectful
assertions with the repository's existing `Effect.runPromise` pattern. Mount
async atoms before yielding or advancing time.

Registry idle TTL, `Atom.swr`, `Atom.debounce`, and several focus/storage helpers
use host timers or `Date.now`; control those with the test runner's fake timers.
Use `TestClock` only when the Effect inside the runtime is explicitly receiving
the test clock service.

## Review Checklist

- Atom and serializable identities are stable and unique.
- Command reads are not mistaken for reactive dependencies.
- Async UI preserves both stale values and the `waiting` flag.
- Every subscription or mount has a matching release.
- High-cardinality families have a bounded cache policy.
- Reactivity keys have the intended broad or per-id overlap.
- Hydration happens before first read and uses a synchronous compatible schema.
- Time and finalization behavior are covered by tests.
