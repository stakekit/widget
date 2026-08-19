# StakeKit Widget - Agent Guide

Monorepo (`pnpm` workspaces + Turborepo). Main package is `@stakekit/widget` in
`packages/widget` (React + TypeScript + Vite), published both as a React
component (`src/index.package.ts`) and as a bundled renderer
(`src/index.bundle.ts`).

This guide is operational: commands, conventions, and where to read more. It
deliberately does not restate the architecture.

## Where to look

| For | Read |
| --- | --- |
| Module ownership, dependency direction, feature entries, Effect services, runtimes, Atom conventions, React Context policy | `packages/widget/ARCHITECTURE.md` |
| Domain vocabulary (use it in code, tests, commits) | `CONTEXT.md` |
| Accepted decisions and their rationale | `docs/adr/` |
| Transaction journeys | `ARCHITECTURE.md` next to `features/{classic-transaction-flow,borrow-transaction-flow,transaction-workflow}` |
| Effect APIs before writing Effect code | `.repos/effect/LLMS.md`, then the smallest relevant `agent-patterns/*.md` (see its README) |
| Issue tracker / triage labels / domain docs | `docs/agents/` |

`packages/widget/src` is organized by ownership, not by React mechanism: `app/`
composes, `features/` owns feature behavior, `resources/` owns cacheable remote
reads, `services/` owns side effects, `domain/` owns framework-independent rules,
`shared/` owns neutral utilities and the UI kit, `public-api/` owns host-facing
types.

## Commands

Run every pnpm command through the version pinned by mise: `mise exec -- pnpm ...`.

Do not install dependencies unless a manifest or lockfile changed, `node_modules`
is missing or invalid, or the work genuinely requires it. When sandboxed, request
approval to install outside the sandbox so pnpm uses the normal global store —
never fall back to a sandboxed install or a project-local `.pnpm-store`. If
approval is denied, report the blocked install instead of reconfiguring the store.

Root (all workspaces):

- `pnpm lint` — Biome + `tsc` per package, plus the root `lint:ast` ast-grep scan.
- `pnpm check-hygiene` — architecture enforcement (see below). **Root only.**
- `pnpm check` — lint + hygiene + test + build. Use before handing off a large change.
- `pnpm build`, `pnpm test`, `pnpm format`.

Widget only (preferred for most tasks) — `pnpm --filter @stakekit/widget <script>`:

- `lint` — Biome + `tsc`. `dev` — standalone dev site.
- `test:unit` (Node), `test:dom` (jsdom), `test:browser` (Chromium).
- `test:changed`, `test:changed:all` — affected tests; the latter includes Chromium.

Test project is selected by filename: `*.browser.test.*`, `*.dom.test.*`,
everything else runs in Node.

## Architecture enforcement

`ARCHITECTURE.md` is the intent; these are the mechanism. A failure is a design
problem, not a config problem to silence. Do not add blanket suppressions —
`lint:ast` fails on suppress-all and on unused ones.

- `check-hygiene` delegates to the widget-owned dependency-cruiser policy and
  Knip's ordinary and production analyses. Run it whenever you move, rename,
  add, or delete a module — plain `lint` will not catch dependency-graph or
  reachability problems.
- Dependency-cruiser keeps generated runtime clients private to `services/api`.
  Biome rejects React in `domain`/`resources`/`services` and allows barrel files
  only at the declared public entries.
- ast-grep (`tools/ast-grep/rules`) catches ad hoc Atom runtimes, direct Effect
  runtime execution, native `Date`, global `fetch`, throws inside Effect
  generators, and wildcard exports from Module interfaces.

## Module interfaces

Each `src/features/<name>` publishes only the root interfaces it needs;
**everything else is private**, whether nested or at the Feature root.

- `index.ts` — non-rendering models, Atoms, commands, published types, and
  zero-logic React adapter hooks.
- `composition.ts` — routes, screens, layouts, providers, guards, and global
  mounts for application or enclosing-Module composition.
- `views.ts` — rendered elements and rendering-only hooks intentionally reusable
  by the application, peer Modules, or an outbound package entrypoint.
- `runtime.ts` — Effect modules and Layers for application or enclosing-Module
  runtime assembly.
- Internals live in `model/` (pure TS), `state/` (Effect + Atom), `react/` (hook adapters), `ui/` (components and pages). Migrated orchestration-heavy features split `state/orchestration/` (Atom-independent Effect modules) from `state/atoms/` (reactive and lifecycle adapters).

Adapter hooks go in `index.ts`, not `composition.ts` or `views.ts` — a hook
that only reads an Atom is part of the headless interface, and routing it
through rendered entries drags their page graphs into consumers.

Keep barrels narrow: publish the collaboration contract, not the machinery.
Create only the entries a feature actually shares, and delete ones with no
consumer. Adding a root module is not a way to publish something. Test-only
machinery stays private and is deep-imported by the test.

Each immediate child of `src/resources` is a Resource Module and must publish
`index.ts`. Nested Module Collections follow the same interface roles; their
enclosing Module consumes the child interface and defines its own facade or
composer instead of re-exporting child-owned symbols.

`src/services/api` is a singular owned Module. It publishes
`resource-sources.ts` to Resource Modules, `operations.ts` to Feature
orchestration and Transaction Workflow internals, and `runtime.ts` to
application runtime assembly. Transport, generated clients, and capability
implementations are private. `runtime.ts` owns the single composed API Layer;
there is no API `index.ts`.

Biome's `noBarrelFile` is whitelisted only for declared interfaces. Interfaces
use explicit named exports, never `export *` or `export * as`; implementation
imports directly within its owner, while outside value, type-only, and dynamic
dependencies use an allowed interface. Tests retain deep-import access, and
cross-Module style implementation imports are allowed only from one `*.css.ts`
module to another. Other
exceptions must be exact, named, justified, and give a removal condition when
temporary. New Modules require no per-name architecture registration.

## Coding rules

These are not in `ARCHITECTURE.md`; they apply to all code you write.

**React / Effect boundary.** React is the view layer. New or materially
refactored multi-step orchestration, retries, rollback, concurrency, failures,
and workflow lifetimes belong in Atom-independent Effect modules. Effect Atom
owns reactive composition, resource binding, feature-local state, and adapters.
Event handlers stay synchronous:
normalize the event and dispatch an Atom command — never `Effect.runPromise`,
await, sequence retries, or clean up domain resources there. Use `useEffect`
only for unavoidable React/DOM/third-party lifecycle boundaries, never for data
fetching, state mirroring, or workflow advancement; isolate and document any
exception in a named boundary adapter. Application-logic modules must not import
React. Prefer headless Effect services over React-only third-party APIs.

**Runtimes.** Run feature Effects through the existing application or wallet Atom
runtimes and injected services. Never construct an ad hoc runtime.

**Orchestration modules.** An orchestration-heavy feature exposes one
feature-owned Effect service, composed once by the application or wallet
runtime. Resolve its static dependencies during layer construction; do not
locally re-provide them while operations run. Private scoped child modules take
only genuinely dynamic lifecycle inputs. Interfaces expose semantic operations
and only the state or event Streams that production consumes. They execute
required navigation, tracking, invalidation, and other side effects themselves
and never accept or return Atoms, registries, or Atom contexts.

**Atom commands.** A command Atom may read a snapshot, normalize it through a
pure function, and perform exactly one local state transition, one scoped-handle
operation, or one cross-feature tail delegation. It must not access the registry,
subscribe, mount, refresh-and-wait, retry, coordinate multiple commands, or
perform rollback. Use the shared app-runtime lifecycle adapter for scoped-handle
acquisition, keep-alive, optional state projection, and release rather than
reproducing manual mount graphs in features. Authoritative Resources retain the
Atom machinery required by their cache and lifetime policies.

**Data fetching.** No React Query, hook-owned fetches, or Promise caches for new
or refactored resources — use Effect services exposed through Atom. The only
sanctioned React Query client is the Wagmi/RainbowKit shell at
`src/app/composition/providers/query-client/index.tsx`. Resources and command
adapters publish loading, typed failures, retry eligibility, and stale-result
suppression owned by their resource or orchestration module; React renders
published state and dispatches Retry.

**State ownership.** Deterministic constructors, transitions, invariants, and
projections stay plain TypeScript. Feature `model/` modules must not import
Effect Atom or accept Atom readers. Each workflow fact has one authoritative
writer: Atom may passively project Effect-owned state but cannot maintain a
writable copy or fabricate a synthetic initial lifecycle state. Represent
scoped-handle acquisition explicitly when no authoritative state exists yet.
Local synchronous presentation state (focus, hover, disclosure, refs) may stay
in React.

**Time.** Use Effect `DateTime` for instants, `Duration` for intervals, and
`Clock`/`DateTime.now` for current time. No native `Date`, native-Date Effect
schemas, or `date-fns`. See `docs/adr/0010-effect-datetime-owns-application-time.md`.

**Style.** React Compiler is enabled — do not add `useMemo`, `useCallback`, or
`React.memo` for render performance. No nested ternaries or mutable bindings for
value selection; prefer `const` results from pure resolvers, and Effect `Match`
for closed domain alternatives.

**Copy.** User-facing copy changes update both
`src/translation/English/translations.json` and
`src/translation/French/translations.json`.

**Lifecycle.** At most one Widget Instance per document; sequential unmount and
remount is supported. Do not add machinery for concurrent instances.

**Public API.** Keep `src/index.package.ts` and `src/index.bundle.ts`
compatible; host-facing types live in `src/public-api/`. Never import either
entrypoint from inside `src` — they are outbound-only.

## Before finishing

- Run `pnpm --filter @stakekit/widget lint` for lint and type errors.
- Run `pnpm check-hygiene` if you changed the import graph.
- Test Effect-native orchestration through the real service layer's semantic
  operations and production-observable state; keep registry tests limited to
  service lookup, Atom projection and forwarding, and route-scope lifecycle.
- Treat `.repos/` as read-only agent reference material; never import from it.
