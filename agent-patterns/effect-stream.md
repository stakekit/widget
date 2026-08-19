# Effect Stream Patterns

Use this guide when data is incremental, pull-based, potentially large, or
open-ended: polling, pagination, events, queues, byte streams, concurrent
pipelines, and resource-backed producers.

The source of truth is the vendored Effect repository, especially:

- `.repos/effect/packages/effect/src/Stream.ts`
- `.repos/effect/ai-docs/src/02_stream`
- `.repos/effect/packages/effect/test/Stream.test.ts`
- platform adapters such as
  `.repos/effect/packages/platform-node-shared/src/NodeStream.ts`

Read `effect-http-client.md` as well for HTTP response or request bodies, and
`effect-atoms.md` when a stream backs an atom.

## Imports

Prefer the stable `effect` barrel unless nearby code uses module imports.
Testing utilities have a separate entry point.

```ts
import {
  Cause,
  Effect,
  Fiber,
  Option,
  Queue,
  Schedule,
  Sink,
  Stream
} from "effect"
import { TestClock } from "effect/testing"
```

For Node.js readable streams, use the platform adapter only in Node-specific
code.

```ts
import { NodeStream } from "@effect/platform-node"
```

## Mental Model

`Stream.Stream<A, E, R>` is a lazy description that can emit zero or more `A`
values, fail with `E`, and require services `R`. It does not start until a
destructor consumes it.

```ts
const regions = Stream.fromEffect(loadConfig).pipe(
  Stream.map((config) => config.region)
)

const program = regions.pipe(Stream.runCollect)
```

Running `program` twice runs the stream description twice. Reusing a stream
value does not memoize or share a producer. Sharing requires an explicit scoped
combinator such as `share`, `broadcast`, or `broadcastN`.

## Choose The Smallest Source

| Source shape | Constructor |
| --- | --- |
| In-memory values | `empty`, `succeed`, `make`, `fromIterable` |
| One effectful value | `fromEffect` |
| Effect repeated on a schedule | `fromEffectSchedule` |
| Cursor/page API | `paginate` |
| Existing async iterable | `fromAsyncIterable` |
| DOM/EventTarget events | `fromEventListener` |
| General callback API | `callback` |
| Effect queue or pubsub | `fromQueue`, `fromPubSub` |
| Web readable stream | `fromReadableStream` |
| Node readable stream | `NodeStream.fromReadable` |

Prefer a structure-preserving constructor over mutable state inside
`Stream.callback`. Pagination should usually be `Stream.paginate`; polling
should usually be `Stream.fromEffectSchedule`.

```ts
const jobs = Stream.paginate(0, (page) =>
  JobApi.use((api) => api.listJobs({ page })).pipe(
    Effect.map(({ items, nextPage }) => [
      items,
      nextPage === null ? Option.none() : Option.some(nextPage)
    ] as const)
  )
)
```

`paginate` emits each item from the iterable returned in the first tuple slot
and continues only while the second slot is `Option.some(nextState)`. Derive the
next cursor from validated source metadata, not from the number of domain items
left after filtering or tolerant decoding.

`fromEffectSchedule` runs the effect immediately, then follows the schedule.
Bound it with `take` when the resulting stream must be finite.

## End Every Pipeline With An Intentional Consumer

Common destructors:

| Need | Destructor |
| --- | --- |
| Execute an effect per element | `runForEach` |
| Ignore values but run effects | `runDrain` |
| Fold incrementally | `runFold`, `runFoldEffect`, `run(Sink...)` |
| Read an optional edge | `runHead`, `runLast` |
| Collect a bounded stream | `runCollect` |
| Count without retaining values | `runCount` |
| Concatenate bounded text/bytes | `mkString`, `mkUint8Array` |

```ts
const writeEvents = events.pipe(
  Stream.runForEach((event) =>
    EventStore.use((store) => store.write(event))
  )
)
```

Use `runCollect`, `mkString`, and `mkUint8Array` only when output is finite and
bounded. Apply `take` first when a test or caller needs a bounded prefix.

`runHead` can stop after one element. `runLast` must wait for completion and
therefore never finishes for a healthy infinite stream.

## Transform Elements, Arrays, And Windows Deliberately

Use element operators for domain logic:

```ts
const enriched = orders.pipe(
  Stream.filter((order) => order.status === "paid"),
  Stream.mapEffect(enrichOrder, { concurrency: 4 })
)
```

Use array-aware operators only when source chunking or batching matters:

- `mapArray` and `mapArrayEffect` transform emitted non-empty arrays.
- `runForEachArray` consumes arrays without flattening first.
- `grouped(n)` creates size-bounded batches.
- `groupedWithin(n, duration)` flushes on size or time.
- `bufferArray` preserves source arrays; `buffer` buffers elements and destroys
  the original chunking.

```ts
const batched = events.pipe(
  Stream.groupedWithin(100, "1 second"),
  Stream.mapEffect((batch) =>
    EventStore.use((store) => store.writeBatch(batch))
  )
)
```

Do not insert `runCollect` in the middle of a pipeline merely to batch values.
That ends streaming, retains all prior elements, and changes interruption and
backpressure behavior.

## Bound Concurrency And Know Ordering

`mapEffect` defaults to sequential execution. With concurrent execution it
preserves input order unless `{ unordered: true }` is set.

```ts
const results = ids.pipe(
  Stream.mapEffect(
    (id) => RemoteApi.use((api) => api.fetch(id)),
    { concurrency: 8 }
  )
)
```

Use `unordered: true` only when output order is irrelevant and head-of-line
blocking is undesirable.

`flatMap` has different semantics: with concurrency greater than one, inner
streams are merged and their values arrive in runtime order. It has no ordered
concurrent mode. `mergeAll` likewise emits from whichever active stream
produces first.

```ts
const merged = Stream.mergeAll(streams, {
  concurrency: 4,
  bufferSize: 16
})
```

Choose a concrete I/O concurrency limit. Use `"unbounded"` only when upstream
cardinality is already tightly bounded and reviewed.

When processing stateful updates, ask whether concurrent work is valid at all.
Ordered output does not prevent effects themselves from running concurrently.

## Treat Buffers As A Correctness Choice

Bound queues, callbacks, pubsubs, shared streams, and explicit buffers by
default. Choose the overflow strategy from the product semantics:

- `"suspend"` applies backpressure and retains every value.
- `"sliding"` drops older buffered values and keeps recent state.
- `"dropping"` keeps older buffered values and drops new arrivals.

```ts
const buffered = source.pipe(
  Stream.buffer({ capacity: 32, strategy: "suspend" })
)
```

Backpressure works only when the producer can await an effectful offer. An
external synchronous callback cannot pause for `Queue.offer`; with bounded
callback sources, dropped/coalesced values must be acceptable or the external
API must provide its own pause/resume mechanism.

Capacity is measured in elements for `buffer` and `toQueue`, but in emitted
arrays for `bufferArray` and broadcast internals. Do not treat every
`bufferSize` as the same unit without checking the signature and source.

## Manage Scope And Finalization

Streams hold acquired resources for the duration of one consumption. Use
`Stream.scoped` to internalize a `Scope` requirement.

```ts
const connectionStream = Stream.scoped(
  Stream.fromEffect(
    Effect.acquireRelease(
      Connection.open,
      (connection) => connection.close()
    )
  )
)
```

Use `Stream.ensuring` for a finalizer that should run after every consumption,
regardless of success, failure, or interruption. Use `Effect.acquireRelease`
when cleanup belongs to an acquired handle.

Scoped destructors and sharing operations include:

- `Stream.toPull`
- `Stream.toQueue` and `Stream.toPubSub*`
- `Stream.broadcast`, `broadcastN`, and `share`

Acquire them inside `Effect.scoped` or a layer. Closing the scope must stop the
producer and release queues, subscriptions, and external handles.

Web readable streams are canceled by default when their Effect stream
finalizes. `NodeStream.fromReadable` can close Node streams on completion. Keep
those defaults unless ownership belongs elsewhere.

## Bridge Callback APIs Safely

Use `fromEventListener` for EventTarget-like APIs. It removes the listener when
the stream ends.

```ts
const clicks = Stream.fromEventListener<PointerEvent>(
  button,
  "click",
  { passive: true, bufferSize: 16 }
)
```

`fromEventListener` exposes `bufferSize` but not an overflow strategy. Its
synchronous listener cannot suspend; when a bounded buffer is full, a new event
may be rejected. Use `Stream.callback` when sliding or dropping behavior must be
chosen explicitly.

Use `Stream.callback` when registration, error, completion, or overflow behavior
needs explicit control.

```ts
const messages = Stream.callback<Message, SocketError>(
  (queue) =>
    Effect.acquireRelease(
      Effect.sync(() => {
        const unsubscribeMessage = socket.onMessage((message) => {
          Queue.offerUnsafe(queue, message)
        })

        const unsubscribeClose = socket.onClose(() => {
          Queue.endUnsafe(queue)
        })

        const unsubscribeError = socket.onError((error) => {
          Queue.failCauseUnsafe(queue, Cause.fail(error))
        })

        return {
          unsubscribeClose,
          unsubscribeError,
          unsubscribeMessage
        }
      }),
      (subscriptions) =>
        Effect.sync(() => {
          subscriptions.unsubscribeMessage()
          subscriptions.unsubscribeClose()
          subscriptions.unsubscribeError()
        })
    ),
  { bufferSize: 64, strategy: "sliding" }
)
```

Signal normal completion with `Queue.endUnsafe` and failure with
`Queue.failCauseUnsafe(queue, Cause.fail(error))`; otherwise consumers can wait
forever. Register every external cleanup through the supplied scope.

Use effectful `Queue.offer` when producer code is already inside Effect and can
honor backpressure. Use `offerUnsafe` only at a synchronous callback boundary,
and choose an overflow policy that remains correct if it cannot enqueue.

## Choose Sharing Semantics Explicitly

Several consumers of a plain stream each run an independent producer. Use the
sharing primitive that matches subscriber lifetime:

| Need | Primitive |
| --- | --- |
| Dynamic, reference-counted subscribers | `Stream.share` |
| Dynamic subscribers to one scoped pubsub producer | `Stream.broadcast` |
| Fixed number of consumers that must all subscribe before start | `Stream.broadcastN` |
| Competing work consumers | `Queue` / `Stream.toQueue` |
| Every subscriber receives each published event | `PubSub` |

`share` starts upstream for the first subscriber and stops it after the last
subscriber leaves. A later subscriber restarts the source unless
`idleTimeToLive` keeps it alive. `replay` controls what a late subscriber can
receive from the shared pubsub; it does not turn the source into a permanent
cache.

```ts
const program = Effect.scoped(
  Effect.gen(function*() {
    const shared = yield* updates.pipe(
      Stream.share({ capacity: 16, replay: 1 })
    )

    yield* Effect.all([
      shared.pipe(Stream.runForEach(handleForLeftConsumer)),
      shared.pipe(Stream.runForEach(handleForRightConsumer))
    ], { concurrency: "unbounded" })
  })
)
```

`broadcastN` is safer when exactly N consumers must observe a finite source: it
does not start until all N returned streams are subscribed. For dynamic
`broadcast` subscribers, use replay or an external readiness protocol if early
values cannot be missed.

## Use Queues And PubSubs At Ownership Boundaries

`Stream.toQueue` creates a scoped dequeue, feeds it in a child fiber, ends it
with `Cause.Done`, and fails it with the stream failure.

```ts
const program = Effect.scoped(
  Effect.gen(function*() {
    const queue = yield* source.pipe(
      Stream.toQueue({ capacity: 32 })
    )

    return yield* Queue.take(queue)
  })
)
```

Multiple queue consumers compete for values. Use a PubSub when every subscriber
needs a copy. `Stream.fromQueue` treats `Cause.Done` as normal stream completion;
other queue failures become stream failures.

Prefer `Stream.broadcast` or `Stream.fromPubSub` over manually copying each
event into multiple queues.

## Keep Service Requirements Until The Boundary

Stream service requirements compose like Effect requirements. Provide the
smallest layer at a stable application or test boundary.

```ts
const users = Stream.fromEffect(
  UserApi.use((api) => api.listUsers())
).pipe(
  Stream.flatMap(Stream.fromIterable)
)

const program = users.pipe(
  Stream.runForEach(renderUser),
  Effect.provide(UserApi.layer)
)
```

When converting a serviceful stream for non-Effect consumers, capture services
explicitly with `toReadableStreamEffect`, `toReadableStreamWith`,
`toAsyncIterableEffect`, or `toAsyncIterableWith`. The plain conversion
variants work only when the stream requires no services.

Cancellation of the returned readable stream or async iterator is what closes
the Effect scope. Consumers that abandon a manual iterator must call `return()`;
`for await...of` does this when the loop exits normally.

## Recover At The Correct Level

Use stream combinators when recovery should continue as a stream:

- `catchTag`, `catchTags`, and `catchIf` for typed recovery
- `catchCause` when defects/interruption are deliberately part of policy
- `mapError` to translate the stream failure channel
- `retry` to restart a failed source
- `result` to expose successes and the first failure as values

```ts
const recovered = source.pipe(
  Stream.catchTag("RateLimitError", () =>
    Stream.fromEffectSchedule(
      Effect.succeed({ type: "retrying" as const }),
      Schedule.spaced("1 second")
    ).pipe(Stream.take(1))
  )
)
```

Use `Effect.catchTag` after `Stream.run*` when the entire consumption should be
handled as one effect.

`Stream.retry` restarts the source description. Values emitted before failure
can be emitted again after the restart. Retry only when duplicated prefixes and
reacquiring the source are safe, or add an explicit cursor/checkpoint protocol.

`Stream.result` emits success results and then one failure result; it still ends
after that first failure. It is not a way to resume the failed source.

## Decode Incremental Bytes Incrementally

Decode bytes before string operations, and use `splitLines` so delimiters split
across source arrays are handled correctly.

```ts
const lines = responseBytes.pipe(
  Stream.decodeText(),
  Stream.splitLines,
  Stream.runForEach(processLine)
)
```

For NDJSON and Msgpack, use the encoding channels and schema-backed variants
instead of `JSON.parse` in `Stream.map`.

```ts
import { Ndjson } from "effect/unstable/encoding"

const events = bytes.pipe(
  Stream.pipeThroughChannel(Ndjson.decodeSchema(Event)()),
  Stream.mapError((cause) => new EventDecodeError({ cause }))
)
```

Use `ignoreEmptyLines: true` only when blank lines are valid transport noise.
Schema decoding should remain at the trust boundary so malformed input has a
typed failure path.

## Testing

A stream test must consume the stream. Bound infinite streams with `take` and
test finalization as well as output.

```ts
import { Effect, Fiber, Schedule, Stream } from "effect"
import { TestClock } from "effect/testing"
import { expect, it } from "vitest"

it("polls three times", async () => {
  const values = await Effect.runPromise(
    Effect.gen(function*() {
      const fiber = yield* Stream.fromEffectSchedule(
        Effect.succeed("tick"),
        Schedule.spaced("1 second")
      ).pipe(
        Stream.take(3),
        Stream.runCollect,
        Effect.forkChild({ startImmediately: true })
      )

      yield* TestClock.adjust("2 seconds")

      return yield* Fiber.join(fiber)
    }).pipe(Effect.provide(TestClock.layer()))
  )

  expect(values).toEqual(["tick", "tick", "tick"])
})
```

For callback, queue, readable-stream, and sharing tests:

- start live consumers before publishing
- assert overflow behavior with a deliberately slow consumer
- close or interrupt the scope and assert external cleanup
- test normal completion and source failure
- use `TestClock` for schedules, debounce, throttle, retry, and time windows

Avoid real sleeps. A time-controlled test may need a start-immediate fork so the
stream reaches its scheduled suspension before the clock advances.

## Review Checklist

- The source constructor matches the real source shape.
- Every collection is proven finite and bounded.
- Concurrency and output ordering are both intentional.
- Buffer capacity and overflow strategy match loss/backpressure requirements.
- Every acquired handle and shared producer has a scoped finalizer.
- Callback sources signal end/failure and tolerate unsafe-offer overflow.
- Sharing semantics match dynamic, fixed, competing, or fan-out consumers.
- Retry cannot duplicate unsafe work or already emitted values.
- Tests consume the stream and cover time, failure, and cleanup behavior.
