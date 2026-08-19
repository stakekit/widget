# Effect HttpClient Patterns

Use this guide for outgoing HTTP APIs: request construction, generated clients,
middleware, retries, rate limits, response decoding, streaming bodies, and
tests.

The source of truth is the vendored Effect repository, especially:

- `.repos/effect/packages/effect/src/unstable/http/HttpClient.ts`
- `.repos/effect/packages/effect/src/unstable/http/HttpClientRequest.ts`
- `.repos/effect/packages/effect/src/unstable/http/HttpClientResponse.ts`
- `.repos/effect/packages/effect/src/unstable/http/HttpClientError.ts`
- `.repos/effect/packages/effect/src/unstable/http/HttpIncomingMessage.ts`
- `.repos/effect/packages/effect/src/unstable/http/FetchHttpClient.ts`
- `.repos/effect/packages/effect/src/unstable/persistence/RateLimiter.ts`
- `.repos/effect/packages/effect/test/unstable/http`

Read `effect-stream.md` as well when a request or response body is streamed.

## Imports And Transport

Match nearby code. The unstable HTTP barrel is convenient for hand-written
services; generated clients in this repository use module imports.

```ts
import { Context, Effect, flow, Layer, Schedule, Schema, Stream } from "effect"
import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
  HttpClientResponse
} from "effect/unstable/http"
import { RateLimiter } from "effect/unstable/persistence"
```

An `HttpClient` describes request preprocessing and response postprocessing. A
platform layer supplies the low-level transport:

- `FetchHttpClient.layer` for browsers, edge runtimes, and portable Fetch code
- a nearby Node or browser-specific client when its transport behavior is
  required

Fetch behavior such as CORS, credentials, redirect defaults, and streaming
support still depends on the runtime. Do not assume all platform layers behave
identically.

## Put API Policy In A Service Boundary

Generated code should describe endpoints. Hand-written transport or service
layers should own base URLs, authentication, retry policy, observability, and
domain error mapping.

```ts
class Todo extends Schema.Class<Todo>("Todo")({
  id: Schema.Number,
  title: Schema.String,
  completed: Schema.Boolean
}) {}

export class TodoApi extends Context.Service<TodoApi, {
  readonly getTodo: (id: number) => Effect.Effect<Todo, TodoApiError>
}>()("app/TodoApi") {
  static readonly layer = Layer.effect(
    TodoApi,
    Effect.gen(function*() {
      const client = (yield* HttpClient.HttpClient).pipe(
        HttpClient.mapRequest(flow(
          HttpClientRequest.prependUrl("https://example.com/api"),
          HttpClientRequest.acceptJson
        )),
        HttpClient.filterStatusOk,
        HttpClient.retryTransient({
          schedule: Schedule.exponential(100),
          times: 3
        })
      )

      const getTodo = Effect.fn("TodoApi.getTodo")(function*(id: number) {
        yield* Effect.annotateCurrentSpan({ id })

        return yield* client.get(`/todos/${id}`).pipe(
          Effect.flatMap(HttpClientResponse.schemaBodyJson(Todo)),
          Effect.mapError((cause) => new TodoApiError({ cause }))
        )
      })

      return TodoApi.of({ getTodo })
    })
  ).pipe(Layer.provide(FetchHttpClient.layer))
}

export class TodoApiError extends Schema.TaggedError<TodoApiError>()(
  "TodoApiError",
  { cause: Schema.Defect() }
) {}
```

Acquire and configure the shared client once while building the service. Keep
endpoint functions small and map library errors into domain errors at this
boundary. Do not leak authentication headers or raw response bodies into logs.

## Build Immutable Requests

Use `HttpClientRequest` constructors and combinators instead of hand-building
Fetch options. Every combinator returns a new request.

```ts
const request = HttpClientRequest.post("/todos").pipe(
  HttpClientRequest.setUrlParams({ format: "json" }),
  HttpClientRequest.bearerToken(token),
  HttpClientRequest.acceptJson,
  HttpClientRequest.bodyJsonUnsafe(payload)
)

const response = yield* client.execute(request)
```

Choose body encoding deliberately:

- `schemaBodyJson(schema)(value)` validates/encodes through a schema and can
  require encoding services.
- `bodyJson(value)` catches JSON encoding failures as `HttpBodyError`.
- `bodyJsonUnsafe(value)` is synchronous but may throw. Reserve it for generated
  code or values whose serializability is already guaranteed.

```ts
const createTodo = (input: typeof NewTodo.Type) =>
  HttpClientRequest.post("/todos").pipe(
    HttpClientRequest.schemaBodyJson(NewTodo)(input),
    Effect.flatMap(client.execute),
    Effect.flatMap(HttpClientResponse.schemaBodyJson(Todo))
  )
```

Use `setUrlParams` to replace values and `appendUrlParams` to preserve repeated
keys. Passing a `URL` to a request constructor extracts its query and hash into
the request's structured fields.

Be careful with middleware that sets headers: later `setHeader` calls replace
the same header. Prefer one clearly owned authentication transform.

## Decide Status Policy Before Decoding

HTTP status is data by default. `HttpClient` succeeds with a response for 4xx
and 5xx statuses unless a filter turns them into failures.

Use a client-wide filter only when every endpoint has the same status contract:

```ts
const okClient = client.pipe(HttpClient.filterStatusOk)

const todo = yield* okClient.get("/todos/1").pipe(
  Effect.flatMap(HttpClientResponse.schemaBodyJson(Todo))
)
```

For typed non-2xx responses, do not apply `filterStatusOk` before matching.
Branch on the raw response first:

```ts
const result = yield* client.post("/todos").pipe(
  Effect.flatMap(HttpClientResponse.matchStatus({
    201: HttpClientResponse.schemaBodyJson(Todo),
    400: (response) =>
      HttpClientResponse.schemaBodyJson(ApiProblem)(response).pipe(
        Effect.flatMap((problem) => Effect.fail(new BadRequest({ problem })))
      ),
    "5xx": (response) =>
      Effect.fail(new RemoteServiceUnavailable({ status: response.status })),
    orElse: (response) =>
      Effect.fail(new UnexpectedStatus({ status: response.status }))
  }))
)
```

Exact status handlers win over status-class handlers. Always include `orElse`
so new or undocumented statuses have an explicit path.

## Know The Error Layers

There is not one universal HTTP error type. The operation determines the error
channel:

| Operation | Typical failure |
| --- | --- |
| Request schema/JSON encoding before execution | `HttpBodyError` |
| Transport, URL construction, status filtering, body reading | `HttpClientError` |
| Schema validation of decoded body/headers | `SchemaError` |
| Hand-written API boundary | mapped domain error |

`HttpClientError` wraps a more specific `reason`:

- `TransportError`, `EncodeError`, and `InvalidUrlError` have no response.
- `StatusCodeError`, `DecodeError`, and `EmptyBodyError` include a response.

Catch the outer `HttpClientError`, then inspect `reason._tag`. Catching
`StatusCodeError` directly with `Effect.catchTag` does not work on a normal
client call because it is nested.

```ts
const recovered = client.get("/todos/1").pipe(
  Effect.flatMap(HttpClientResponse.filterStatusOk),
  Effect.catchTag("HttpClientError", (error) => {
    if (
      error.reason._tag === "StatusCodeError" &&
      error.response?.status === 404
    ) {
      return Effect.succeedNone
    }
    return Effect.fail(error)
  })
)
```

This handler does not catch `SchemaError` from a later schema decoder. Map both
at the service boundary when the public API exposes one domain error.

## Decode A Body Once, Deliberately

Raw body readers are effects and can fail with `HttpClientError`:

```ts
yield* response.text
yield* response.json
yield* response.arrayBuffer
yield* response.urlParamsBody
```

Prefer schema decoders at trust boundaries:

```ts
yield* HttpClientResponse.schemaBodyJson(Todo)(response)
yield* HttpClientResponse.schemaJson(ResponseEnvelope)(response)
yield* HttpClientResponse.schemaNoBody(HeaderOnlyResponse)(response)
```

- `schemaBodyJson` decodes only the JSON body.
- `schemaJson` decodes `{ status, headers, body }` together.
- `schemaNoBody` decodes status and headers without consuming a body.
- `response.json` treats an empty text body as `null`.
- `response.stream` fails with `EmptyBodyError` when there is no body.

Text and array-buffer access are cached by the Web response wrapper, but a body
stream is a live consumable resource. Do not inspect a body through `text` or
`json` and then expect to stream the same body, or stream it and then decode it.
Choose buffered decoding or streaming at the endpoint boundary.

## Understand Middleware Ordering

Request transforms and response transforms compose differently:

- `mapRequest` appends preprocessing; successive calls execute in pipe order.
- `mapRequestInput` prepends preprocessing before transforms already installed.
- Each later response combinator wraps the response behavior built before it.

```ts
const client = baseClient.pipe(
  HttpClient.mapRequest(
    HttpClientRequest.prependUrl("https://api.example.com")
  ),
  HttpClient.followRedirects(),
  HttpClient.filterStatusOk,
  HttpClient.retryTransient({ times: 3 })
)
```

Ordering consequences:

- Put `followRedirects` before `filterStatusOk`; otherwise a visible 3xx can be
  rejected before redirect handling sees it.
- Put `tap` before a status filter to inspect every response, including non-2xx.
  Put it after the filter to observe accepted responses only; use `tapError` for
  rejected ones.
- Middleware inside a retry wrapper runs for every attempt. Middleware added
  after the retry sees only the final outcome.
- `filterStatusOk` may appear before `retryTransient`: transient
  `StatusCodeError` reasons are recognized. Without a filter, transient raw
  responses are also recognized by the default response retry mode.

Use `mapRequestInput` rarely. Most base URLs, headers, and auth belong in normal
`mapRequest` transforms whose order is visible in the pipe.

## Retry Only Safe Operations

`retryTransient` retries timeouts, transport errors, and these statuses:
`408`, `429`, `500`, `502`, `503`, and `504`. Its default mode is
`"errors-and-responses"`.

```ts
const retried = client.pipe(
  HttpClient.retryTransient({
    schedule: Schedule.exponential("100 millis"),
    times: 3
  })
)
```

`times` counts retries, not total attempts. `times: 3` can execute four total
attempts. A custom `while` predicate adds errors to the built-in transient set;
it does not replace that set, and it is ignored in `"response-only"` mode.

The client does **not** check whether the HTTP method is idempotent. The same
policy retries GET and POST. Before applying retries to mutations, require an
API-supported idempotency key or other proof that replay cannot duplicate a
side effect. Prefer separate read and mutation clients when their retry policies
differ.

Also confirm the request body can be replayed. A live stream or external handle
may not be safe to execute again even when the method is idempotent.

## Rate Limiting

`HttpClient.withRateLimiter` coordinates requests that share a key through the
`RateLimiter` service.

```ts
const limited = client.pipe(
  HttpClient.withRateLimiter({
    limiter: yield* RateLimiter.RateLimiter,
    key: (request) => request.url,
    limit: 10,
    window: "1 minute"
  })
)
```

Pick keys with intentional cardinality: per upstream, account, or endpoint.
Avoid accidentally including unique query data when all requests should share a
limit.

By default the middleware learns from common `RateLimit-*`, `X-RateLimit-*`, and
`Retry-After` headers. It sends 429 responses, including filtered 429
`HttpClientError` values, back through the limiter. This 429 loop is not bounded
by a `times` option, so use an enclosing timeout/cancellation policy when the
upstream may remain rate-limited indefinitely.

`disableResponseInspection: true` stops header-based learning. It does not turn
off 429 retries; those still pass through the configured limiter.

Provide both the limiter and its store layer at the application/test boundary.
Use `TestClock` in rate-limit tests rather than real waits.

## Stream Bodies And Control Scope

Convert a response effect directly into a byte stream:

```ts
const text = yield* client.get("/events").pipe(
  HttpClientResponse.stream,
  Stream.decodeText(),
  Stream.mkString
)
```

Keep the body incremental for large or open-ended responses. Do not use
`Stream.mkString`, `runCollect`, or `mkUint8Array` unless the body is known to be
finite and bounded.

Normal responses use an abort controller. Interrupting a body read or ending a
response stream early aborts the underlying request. Apply
`HttpClient.withScope` when the request lifetime must instead be attached to an
explicit surrounding `Scope`; closing that scope aborts it.

## Tracing And Inspection

HttpClient creates client spans by default and records method, URL, status, and
redacted headers. Wrap domain operations in named `Effect.fn` functions or
`Effect.withSpan`, and add safe request identifiers with
`Effect.annotateCurrentSpan`.

Context references can tune client tracing:

- `HttpClient.TracerDisabledWhen` disables spans for matching requests.
- `HttpClient.TracerPropagationEnabled` controls outgoing trace headers.
- `HttpClient.SpanNameGenerator` customizes client span names.

Use `tap`, `tapError`, and `tapRequest` for logging or metrics without changing
results. Body inspection is a real decode and can consume a streamed body; do
it only for endpoints that use buffered bodies. Keep secrets in headers covered
by Effect's redaction configuration.

## Testing

Use a fake `HttpClient.make` transport instead of the network. Build responses
with `HttpClientResponse.fromWeb` and assert the fully preprocessed request when
middleware behavior matters.

```ts
import { expect, it } from "vitest"

it("decodes a todo", async () => {
  const client = HttpClient.make((request) =>
    Effect.succeed(
      HttpClientResponse.fromWeb(
        request,
        new Response(
          JSON.stringify({
            id: 1,
            title: "Test",
            completed: false
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        )
      )
    )
  )

  const todo = await Effect.runPromise(
    HttpClient.get("https://example.com/todos/1").pipe(
      Effect.flatMap(HttpClientResponse.schemaBodyJson(Todo)),
      Effect.provide(Layer.succeed(HttpClient.HttpClient, client))
    )
  )

  expect(todo.id).toBe(1)
})
```

Cover at least the status and decode cases in the public contract. For retry,
redirect, timeout, and rate-limit behavior:

- count attempts with `Ref`
- fork with `startImmediately: true` when the operation must reach a sleep
- provide `TestClock.layer()` and advance `TestClock` from `effect/testing`
- assert interruption and abort signals when lifetime is part of correctness

## Review Checklist

- Generated clients remain generated; policy lives in hand-written layers.
- Every endpoint explicitly filters or matches status.
- Request encoding, `HttpClientError`, and `SchemaError` are mapped intentionally.
- Middleware order matches which attempts/responses each observer should see.
- Retried methods and bodies are safe to replay.
- Rate-limit keys are bounded and persistent 429 behavior is cancellable.
- Large or infinite bodies remain streamed and are consumed once.
- Tests cover non-2xx, invalid payloads, timing, and cancellation as applicable.
