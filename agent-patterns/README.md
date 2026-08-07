# Effect Agent Patterns

These guides describe the Effect APIs used by this repository. They target the
vendored Effect snapshot under `@repos/effect`; unstable APIs can change, so the
vendored source wins whenever a guide and a signature disagree.

## Pick The Smallest Relevant Guide

| Work involves | Read |
| --- | --- |
| Reactive state, async resources, hydration, or atom lifetimes | `effect-atoms.md` |
| Outgoing HTTP requests, generated clients, retries, or response bodies | `effect-http-client.md` |
| Polling, pagination, callback sources, queues, or incremental processing | `effect-stream.md` |

Read more than one guide when a boundary crosses modules. In particular:

- An HTTP response body exposed as a stream needs both the HTTP and Stream
  guides.
- An atom backed by a stream needs both the Atom and Stream guides.
- An atom-backed HTTP query needs all three when it incrementally consumes the
  response.

## Source-Checking Workflow

Before writing Effect code:

1. Read `@repos/effect/LLMS.md`.
2. Read the relevant guide from this directory.
3. Inspect the exact exported signature and nearby implementation in
   `@repos/effect/packages`.
4. Inspect the corresponding vendored tests for lifecycle or concurrency
   behavior that the type signature cannot express.

Use `rg --no-ignore` when searching `@repos/effect`, because the vendored clone
may be ignored by Git locally. Do not use `node_modules` or web documentation as
the authority for Effect behavior in this repository.

## Repository Rules Still Apply

- Match nearby imports and project abstractions before introducing a new one.
- Keep generated API clients generated. Put hand-written behavior in transport
  or service layers rather than editing generated files.
- Prefer `Effect.gen` and named `Effect.fn` functions for domain operations.
- Keep service requirements in the type until the application boundary provides
  the layer.
- Test interruption, finalization, and time-dependent behavior when they are part
  of correctness, not only the happy-path value.
