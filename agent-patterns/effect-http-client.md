# Effect HttpClient Patterns

Use this when writing project code that talks to external HTTP APIs with Effect.
The source of truth reviewed for these patterns is the vendored Effect repo:
`repos/effect/LLMS.md`, `repos/effect/ai-docs/src/50_http-client/10_basics.ts`,
and the `repos/effect/packages/effect/src/unstable/http/HttpClient*.ts` modules
plus their tests.

## Imports

Prefer the unstable HTTP barrel unless nearby code imports individual modules.

```ts
import { Context, Effect, flow, Layer, Schedule, Schema, Stream } from "effect"
import { FetchHttpClient, HttpClient, HttpClientRequest, HttpClientResponse } from "effect/unstable/http"
import { RateLimiter } from "effect/unstable/persistence"
```

Platform implementations are provided as layers. Use `FetchHttpClient.layer` for
portable fetch-based code unless the runtime has a more specific layer nearby
(`NodeHttpClient.layerFetch`, `NodeHttpClient.layerNodeHttp`,
`NodeHttpClient.layerUndici`, `BrowserHttpClient.layerXMLHttpRequest`, etc.).

## Build API Clients As Services

Wrap API-specific HTTP behavior in a `Context.Service` layer. Acquire
`HttpClient.HttpClient` once, then apply shared middleware such as base URL,
headers, status filtering, retries, tracing spans, and error mapping.

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
          Effect.mapError((cause) => new TodoApiError({ cause })),
          Effect.withSpan("TodoApi.getTodo")
        )
      })

      return TodoApi.of({ getTodo })
    })
  ).pipe(
    Layer.provide(FetchHttpClient.layer)
  )
}

export class TodoApiError extends Schema.TaggedErrorClass<TodoApiError>()("TodoApiError", {
  cause: Schema.Defect
}) {}
```

## Requests Are Immutable Values

Use `HttpClientRequest` constructors and combinators instead of hand-building
fetch options. Each combinator returns a new request.

```ts
const request = HttpClientRequest.post("/todos").pipe(
  HttpClientRequest.setUrlParams({ format: "json" }),
  HttpClientRequest.bearerToken(token),
  HttpClientRequest.acceptJson,
  HttpClientRequest.bodyJsonUnsafe(payload)
)

const response = yield* client.execute(request)
```

Prefer schema-backed encoders when a schema exists. `schemaBodyJson` and
`bodyJson` fail in the Effect error channel; `bodyJsonUnsafe` may throw during
JSON encoding and is best reserved for generated code or already-safe payloads.

```ts
const createTodo = (input: typeof NewTodo.Type) =>
  HttpClientRequest.post("/todos").pipe(
    HttpClientRequest.schemaBodyJson(NewTodo)(input),
    Effect.flatMap(client.execute),
    Effect.flatMap(HttpClientResponse.schemaBodyJson(Todo))
  )
```

Use `setUrlParams` when replacing query values and `appendUrlParams` when
multiple values with the same key must be preserved. Passing a `URL` to a
request constructor extracts search parameters and hash into structured request
fields.

## Status Codes Are Not Errors By Default

`HttpClient` succeeds with an `HttpClientResponse` for non-2xx statuses. Choose
one of these explicitly:

```ts
// Simple API: fail on anything outside 2xx.
const json = yield* client.get("/todos/1").pipe(
  Effect.flatMap(HttpClientResponse.filterStatusOk),
  Effect.flatMap(HttpClientResponse.schemaBodyJson(Todo))
)
```

```ts
// Typed API: branch by exact status or status class.
const result = yield* client.post("/todos").pipe(
  Effect.flatMap(HttpClientResponse.matchStatus({
    201: HttpClientResponse.schemaBodyJson(Todo),
    400: (response) =>
      Effect.flatMap(
        HttpClientResponse.schemaBodyJson(ApiProblem)(response),
        (problem) => Effect.fail(new BadRequest({ problem }))
      ),
    "5xx": (response) => Effect.fail(new RemoteServiceUnavailable({ status: response.status })),
    orElse: (response) => Effect.fail(new UnexpectedStatus({ status: response.status }))
  }))
)
```

Use `HttpClient.filterStatusOk` on the client when every request made by that
client expects 2xx responses. Use `HttpClientResponse.matchStatus` when the API
has typed non-2xx responses.

## Decode Responses Deliberately

Body readers are effects and can fail with `HttpClientError`:

```ts
yield* response.text
yield* response.json
yield* response.arrayBuffer
yield* response.urlParamsBody
```

Prefer schema decoders for JSON and headers:

```ts
yield* HttpClientResponse.schemaBodyJson(Todo)(response)
yield* HttpClientResponse.schemaJson(ResponseEnvelope)(response)
yield* HttpClientResponse.schemaNoBody(HeaderOnlyResponse)(response)
```

Use `schemaBodyJson` for body-only JSON. Use `schemaJson` when the schema covers
the whole `{ status, headers, body }` response shape. `response.json` parses an
empty text body as `null`. `response.stream` fails if there is no body.

## Error Handling

The public failure is usually `HttpClientError.HttpClientError`. Inspect
`error.reason._tag` for the precise cause:

- `TransportError`, `EncodeError`, and `InvalidUrlError` happen before a
  response exists.
- `StatusCodeError`, `DecodeError`, and `EmptyBodyError` include the response.

Do not try to catch `StatusCodeError` directly with `Effect.catchTag` on a normal
client call; the outer tag is `HttpClientError`. Catch `HttpClientError` and
branch on `reason._tag`, or map errors at the API service boundary.

```ts
const recovered = client.get("/todos/1").pipe(
  Effect.flatMap(HttpClientResponse.filterStatusOk),
  Effect.catchTag("HttpClientError", (error) => {
    if (error.reason._tag === "StatusCodeError" && error.response?.status === 404) {
      return Effect.succeedNone
    }
    return Effect.fail(error)
  })
)
```

## Middleware Ordering

`HttpClient` middleware transforms a client and is usually read left to right in
the `pipe`.

```ts
const client = baseClient.pipe(
  HttpClient.mapRequest(HttpClientRequest.prependUrl("https://api.example.com")),
  HttpClient.mapRequest(HttpClientRequest.bearerToken(token)),
  HttpClient.filterStatusOk,
  HttpClient.retryTransient({ times: 3 })
)
```

Use `mapRequest` for transformations that should run after existing request
preprocessing. Use `mapRequestInput` only when a transformation must run before
previously installed request middleware.

Useful middleware:

- `mapRequest` / `mapRequestEffect` for base URLs, headers, auth, and request
  normalization.
- `filterStatus` / `filterStatusOk` for turning unacceptable statuses into
  failures.
- `retryTransient` for transport failures, timeouts, and transient statuses
  (`408`, `429`, `500`, `502`, `503`, `504`). The default `retryOn` is
  `"errors-and-responses"`.
- `followRedirects()` for following 3xx `location` headers, defaulting to 10
  redirects.
- `withCookiesRef` for cookie jars across requests.
- `tap`, `tapError`, and `tapRequest` for logging/metrics without changing the
  response.

## Rate Limiting

Use `HttpClient.withRateLimiter` with the `RateLimiter` service when requests
must share a limit by key.

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

By default, it inspects common rate-limit headers such as `ratelimit-limit`,
`x-ratelimit-limit`, `ratelimit-remaining`, `retry-after`, and reset headers.
It also retries `429` responses, including `HttpClientError` values wrapping a
429 `StatusCodeError`, by sending the retry through the limiter again. Set
`disableResponseInspection: true` only when response headers should not affect
future limits.

## Streaming And Scope

For response bodies, prefer `HttpClientResponse.stream(effect)` or unwrap
`response.stream` and consume it with `Stream` combinators.

```ts
const text = yield* client.get("/events").pipe(
  Effect.map((response) => response.stream),
  Stream.unwrap,
  Stream.decodeText(),
  Stream.mkString
)
```

Non-scoped responses are tied to an abort controller so interrupted body reads
and early-ending streams abort the underlying request. If a request lifetime
must be controlled by a surrounding `Scope`, apply `HttpClient.withScope`.

## Tracing

HttpClient creates client spans by default and records method, URL, status, and
redacted headers. Use `Effect.withSpan` around domain operations and
`Effect.annotateCurrentSpan` for request-specific attributes.

Context references can tune tracing:

- `HttpClient.TracerDisabledWhen` disables spans for matching requests.
- `HttpClient.TracerPropagationEnabled` controls outgoing trace headers.
- `HttpClient.SpanNameGenerator` customizes span names.

## Testing Patterns

Use `it.effect`, `assert` / `strictEqual` helpers from `@effect/vitest`, and
`TestClock` for time-dependent behavior. Avoid `Effect.runSync` in tests.

Test API code with `HttpClient.make` and `HttpClientResponse.fromWeb` rather
than real network calls.

```ts
it.effect("decodes todo", () =>
  Effect.gen(function*() {
    const client = HttpClient.make((request) =>
      Effect.succeed(
        HttpClientResponse.fromWeb(
          request,
          new Response(JSON.stringify({ id: 1, title: "Test", completed: false }), {
            status: 200,
            headers: { "content-type": "application/json" }
          })
        )
      )
    )

    const todo = yield* program.pipe(
      Effect.provide(Layer.succeed(HttpClient.HttpClient, client))
    )

    strictEqual(todo.id, 1)
  }))
```

For retry and rate-limit tests, count attempts in a `Ref`, fork the request, and
advance `TestClock` instead of waiting in real time.
