# Effect Stream Patterns

Use this when writing project code that models incremental, pull-based data with
Effect `Stream`. The source of truth reviewed for these patterns is the vendored
Effect repo: `@repos/effect/LLMS.md`,
`@repos/effect/ai-docs/src/02_stream/*`, and
`@repos/effect/packages/effect/src/Stream.ts`.

## Imports

Prefer the stable `effect` barrel unless nearby code imports individual modules.

```ts
import {
  Cause,
  Effect,
  Fiber,
  Option,
  Queue,
  Schedule,
  Sink,
  Stream,
  TestClock
} from "effect"
```

For Node.js readable streams, use the platform adapter in Node-only code.

```ts
import { NodeStream } from "@effect/platform-node"
```

## Streams Are Lazy Descriptions

A `Stream.Stream<A, E, R>` describes a sequence that can emit zero or more `A`
values, fail with `E`, and require services from `R`. It does not run until it
is consumed with `Stream.run*`, `Stream.run`, `Stream.toQueue`,
`Stream.toReadableStream*`, or a similar destructor.

```ts
const stream = Stream.fromEffect(loadConfig)

const program = stream.pipe(
  Stream.map((config) => config.region),
  Stream.runCollect
)
```

Reusing the same stream value reruns the description for each consumer. If
several consumers must observe one running producer, use `Stream.share`,
`Stream.broadcast`, `Stream.broadcastN`, a `Queue`, or a `PubSub`.

## Choose The Smallest Constructor

Use the constructor that matches the source shape.

- `Stream.empty`, `Stream.succeed`, `Stream.make`, `Stream.fromIterable` for
  in-memory values.
- `Stream.fromEffect` for one effectful value.
- `Stream.fromEffectSchedule` for polling an effect over a schedule.
- `Stream.paginate` for cursor or page APIs.
- `Stream.fromAsyncIterable` for existing async iterables.
- `Stream.fromEventListener` for DOM-style event targets.
- `Stream.callback` for callback APIs that need explicit queue control.
- `Stream.fromQueue` and `Stream.fromPubSub` for Effect concurrency primitives.
- `Stream.fromReadableStream` or `NodeStream.fromReadable` for web or Node
  readable streams.

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

Prefer `Stream.paginate` over building a mutable loop with `Stream.callback` for
normal paginated APIs. Prefer `Stream.fromEffectSchedule` over hand-written
sleep loops for polling.

## Consume With Intent

Every stream pipeline should end in a clear consumer.

```ts
const writeEvents = events.pipe(
  Stream.runForEach((event) => EventStore.use((store) => store.write(event)))
)
```

Use `Stream.runCollect` only for finite streams with bounded output. For large
or infinite streams, prefer `Stream.runForEach`, `Stream.runFold`,
`Stream.runFoldEffect`, `Stream.runDrain`, or `Stream.run(Sink...)`.

```ts
const firstTen = source.pipe(
  Stream.take(10),
  Stream.runCollect
)

const total = source.pipe(
  Stream.map((event) => event.value),
  Stream.run(Sink.sum)
)
```

`Stream.runHead` and `Stream.runLast` return `Option`. `runLast` waits for the
stream to complete, so do not use it on open-ended streams.

## Transform Per Element Or Per Chunk Deliberately

Use element operators for ordinary domain logic.

```ts
const enriched = orders.pipe(
  Stream.filter((order) => order.status === "paid"),
  Stream.mapEffect(enrichOrder, { concurrency: 4 })
)
```

Use chunk-aware operators only when chunk boundaries matter or performance is
worth the extra complexity: `Stream.mapArray`, `Stream.mapArrayEffect`,
`Stream.runForEachArray`, `Stream.grouped`, and `Stream.groupedWithin`.

```ts
const batched = events.pipe(
  Stream.groupedWithin(100, "1 second"),
  Stream.mapEffect((batch) => EventStore.use((store) => store.writeBatch(batch)))
)
```

Do not insert `runCollect` in the middle of a pipeline just to batch values.
Batch with stream operators so backpressure and interruption still work.

## Bound Concurrency And Buffers

`Stream.mapEffect`, `Stream.flatMap`, `Stream.mergeAll`, and related operators
can run work concurrently. Choose a concrete concurrency limit for I/O and only
use `"unbounded"` when the upstream is already tightly bounded.

```ts
const results = ids.pipe(
  Stream.mapEffect((id) => RemoteApi.use((api) => api.fetch(id)), {
    concurrency: 8
  })
)
```

Set `unordered: true` only when output order does not matter. Concurrent
`Stream.mergeAll` emits values as they arrive.

```ts
const merged = Stream.mergeAll(streams, {
  concurrency: 4,
  bufferSize: 16
})
```

When creating queues, pubsubs, callbacks, broadcasts, or shared streams, avoid
unbounded capacity by default. Pick a bounded `capacity` and a strategy:

- `suspend` applies backpressure.
- `sliding` keeps newer values and drops older buffered values.
- `dropping` keeps older buffered values and drops newer values.

## Manage Scope And Cleanup

Streams run resources for the duration of consumption. Use `Stream.scoped` when
the stream requires `Scope`, and use `Stream.ensuring` or
`Effect.acquireRelease` inside constructors to register finalizers.

```ts
const resourceStream = Stream.scoped(
  Stream.fromEffect(
    Effect.acquireRelease(
      Connection.open,
      (connection) => connection.close()
    )
  )
)
```

`Stream.broadcast`, `Stream.broadcastN`, `Stream.share`, `Stream.toQueue`, and
`Stream.toPubSub` return scoped effects. Acquire them inside `Effect.scoped` or
inside a layer so the producer and subscribers are finalized.

```ts
const program = Effect.scoped(
  Effect.gen(function*() {
    const shared = yield* updates.pipe(
      Stream.share({ capacity: 16, replay: 1 })
    )

    yield* shared.pipe(Stream.take(1), Stream.runCollect)
  })
)
```

When bridging to web or async protocols, make sure cancellation closes the
underlying handle. `Stream.fromReadableStream` cancels the reader by default.
`NodeStream.fromReadable` can close Node streams when done.

## Bridge Callback APIs Safely

Use `Stream.fromEventListener` for event targets when it fits. It registers and
removes the listener for the stream lifetime.

```ts
const clicks = Stream.fromEventListener<PointerEvent>(button, "click", {
  passive: true,
  bufferSize: 16
})
```

Use `Stream.callback` for custom callback APIs. Register cleanup with
`Effect.acquireRelease`, and signal completion with the queue API instead of
leaving consumers waiting forever.

```ts
const messages = Stream.callback<Message, SocketError>((queue) =>
  Effect.acquireRelease(
    Effect.sync(() => {
      const unsubscribeMessage = socket.onMessage((message) => {
        Queue.offerUnsafe(queue, message)
      })

      const unsubscribeClose = socket.onClose(() => {
        Queue.endUnsafe(queue)
      })

      return { unsubscribeClose, unsubscribeMessage }
    }),
    ({ unsubscribeClose, unsubscribeMessage }) =>
      Effect.sync(() => {
        unsubscribeMessage()
        unsubscribeClose()
      })
  ),
  { bufferSize: 64, strategy: "sliding" }
)
```

Prefer effectful `Queue.offer` when producer code is already inside Effect and
can honor backpressure. Use `Queue.offerUnsafe` only from external synchronous
callbacks where an Effect cannot be yielded.

## Use Queues And PubSubs For Boundaries

Use `Queue` when one producer coordinates with one or more competing consumers
that pull work. `Stream.toQueue` creates a scoped dequeue and signals completion
with `Cause.Done`; stream failures fail the queue.

```ts
const program = Effect.scoped(
  Effect.gen(function*() {
    const queue = yield* source.pipe(Stream.toQueue({ capacity: 32 }))
    const next = yield* Queue.take(queue)
    return next
  })
)
```

Use `PubSub` when each subscriber should receive published events. Use
`Stream.fromPubSub` or `Stream.broadcast` instead of manually copying events
into several queues.

## Provide Services At The Stream Boundary

Service requirements flow through stream types the same way they flow through
`Effect`. Provide a layer to the stream or provide a larger program that runs
the stream.

```ts
const stream = Stream.fromEffect(
  UserApi.use((api) => api.listUsers())
).pipe(
  Stream.flatMap(Stream.fromIterable),
  Stream.provide(UserApi.layer)
)
```

When converting to web APIs outside Effect, use the service-aware variants:
`Stream.toReadableStreamEffect`, `Stream.toReadableStreamWith`,
`Stream.toAsyncIterableEffect`, or `Stream.toAsyncIterableWith`.

## Handle Errors In The Pipeline

Use stream error combinators when recovery should continue as a stream:
`Stream.catchTag`, `Stream.catchTags`, `Stream.catchIf`, `Stream.catchCause`,
`Stream.mapError`, and `Stream.retry`.

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

Use `Effect.catchTag` after a `Stream.run*` call when the whole consumed stream
should fail or recover as one effect. Use `Stream.result` when downstream code
needs successes and the first failure as values; the stream still ends after
that failure.

## Decode And Encode Streaming Data

For byte streams, decode text before string operations and split lines with
`Stream.splitLines` so delimiters spanning chunks are handled correctly.

```ts
const lines = responseBytes.pipe(
  Stream.decodeText(),
  Stream.splitLines,
  Stream.runForEach(processLine)
)
```

For NDJSON or Msgpack, use the encoding channels and schema-backed variants
instead of hand-parsing inside `Stream.map`.

```ts
import { Ndjson } from "effect/unstable/encoding"

const events = bytes.pipe(
  Stream.pipeThroughChannel(Ndjson.decodeSchema(Event)()),
  Stream.mapError((cause) => new EventDecodeError({ cause }))
)
```

Use `ignoreEmptyLines: true` for NDJSON inputs that may contain blank lines.

## Testing Patterns

Use `it.effect` and consume the stream in the test. Bound infinite streams with
`Stream.take`, and use `TestClock` for schedules, debounce, throttle, retries,
or `groupedWithin`.

```ts
import { strictEqual } from "node:assert"
import { Effect, Fiber, Schedule, Stream, TestClock } from "effect"

it.effect("polls three times", () =>
  Effect.gen(function*() {
    const fiber = yield* Stream.fromEffectSchedule(
      Effect.succeed("tick"),
      Schedule.spaced("1 second")
    ).pipe(
      Stream.take(3),
      Stream.runCollect,
      Effect.fork
    )

    yield* TestClock.adjust("2 seconds")

    const values = yield* Fiber.join(fiber)
    strictEqual(values.length, 3)
  }))
```

For queue and callback streams, assert finalization as well as emitted values.
Fork consumers before publishing when the source is live, then interrupt or close
the scope to verify cleanup.
