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
| Effect APIs before writing Effect code | `@repos/effect/LLMS.md`, then the smallest relevant `agent-patterns/*.md` (see its README) |
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

- `check-hygiene` runs `rev-dep` against `.rev-dep.config.jsonc` (module
  boundaries, feature-internal imports, cycles, orphans, unused exports) plus
  `scripts/check-test-only-exports.ts`. Run it whenever you move, rename, add,
  or delete a module — plain `lint` will not catch these.
- Biome confines generated API imports, rejects React in `domain`/`resources`/`services`,
  and allows barrel files only at the declared public entries.
- ast-grep (`tools/ast-grep/rules`) catches ad hoc Atom runtimes, direct Effect
  runtime execution, native `Date`, global `fetch`, and throws inside Effect generators.

## Feature module layout

Each `src/features/<name>` publishes up to three root entries; **everything
else is private**, whether nested or at the feature root.

- `state.ts` — headless entry: view Atoms, command Atoms, pure projections, published types, and zero-logic React adapter hooks.
- `ui.ts` — rendered views the feature owns: routes, pages, layouts.
- `components.ts` — presentational components published for reuse.
- Internals live in `model/` (pure TS), `state/` (Effect + Atom), `react/` (hook adapters), `ui/` (components and pages).

Adapter hooks go in `state.ts`, not `ui.ts` — a hook that only reads an Atom is
part of the headless interface, and routing it through the page barrel drags the
whole page graph into consumers and creates import cycles.

Keep barrels narrow: publish the collaboration contract, not the machinery.
Create only the entries a feature actually shares, and delete ones with no
consumer. Adding a root module is not a way to publish something. Test-only
machinery stays private and is deep-imported by the test.

Biome's `noBarrelFile` is whitelisted for exactly these three filenames, so they
need no suppression comment and no fourth entry name will work. New features
also need a `restrictedDirectImportersDetection` entry in `.rev-dep.config.jsonc`.

## Coding rules

These are not in `ARCHITECTURE.md`; they apply to all code you write.

**React / Effect boundary.** React is the view layer. New or materially
refactored business state, async work, retries, concurrency, and resource
lifetimes belong in Effect and Effect Atom. Event handlers stay synchronous:
normalize the event and dispatch an Atom command — never `Effect.runPromise`,
await, sequence retries, or clean up domain resources there. Use `useEffect`
only for unavoidable React/DOM/third-party lifecycle boundaries, never for data
fetching, state mirroring, or workflow advancement; isolate and document any
exception in a named boundary adapter. Application-logic modules must not import
React. Prefer headless Effect services over React-only third-party APIs.

**Runtimes.** Run feature Effects through the existing application or wallet Atom
runtimes and injected services. Never construct an ad hoc runtime.

**Data fetching.** No React Query, hook-owned fetches, or Promise caches for new
or refactored resources — use Effect services exposed through Atom. The only
sanctioned React Query client is the Wagmi/RainbowKit shell at
`src/app/composition/providers/query-client/index.tsx`. Resources and command
Atoms own loading, typed failures, retry eligibility, and stale-result
suppression; React renders published state and dispatches Retry.

**State ownership.** Deterministic constructors, transitions, invariants, and
projections stay plain TypeScript. Local synchronous presentation state (focus,
hover, disclosure, refs) may stay in React.

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
- Do not edit `@repos/` (read-only vendored reference) or import from it.
