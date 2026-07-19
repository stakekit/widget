# StakeKit Widget - Agent Guide

## Project Overview
- Monorepo managed with `pnpm` workspaces + Turborepo.
- Main package is `@stakekit/widget` in `packages/widget` (React + TypeScript + Vite).
- Widget supports two entry modes:
  - React component export (`src/index.package.ts`)
  - Fully bundled renderer (`src/index.bundle.ts`)
- Runtime branches between classic widget and dashboard variant in `src/App.tsx`.
- Support at most one concurrently mounted Widget Instance per browser document. Sequential unmount and remount is supported.
- Do not preserve or introduce isolation and concurrency machinery solely for multiple Widget Instances. Keep concurrency control required within the single supported Widget Instance.

## Repo Layout (important paths)
- `packages/widget/src/App.tsx` — root app, router setup, bundle renderer.
- `packages/widget/src/Widget.tsx` — non-dashboard route flow (earn/review/steps/details).
- `packages/widget/src/Dashboard.tsx` + `pages-dashboard/*` — dashboard variant UI.
- `packages/widget/src/providers/*` — global provider composition (API, query, wallet, tracking, theme, stores).
- `packages/widget/src/hooks/*` — feature and API hooks.
- `packages/widget/src/domain/*` — shared domain types/helpers.
- `packages/widget/src/translation/*` — i18n resources (`English`, `French`).
- `packages/widget/tests/*` — Vitest Node and browser tests; browser tests use the `.browser.test.*` suffix and MSW.
- `packages/examples/*` — integration examples (`with-vite`, `with-vite-bundled`, `with-nextjs`, `with-cdn-script`).

## Commands Agents Should Use

### Package manager and dependency installation

- Run all pnpm commands through the version pinned by mise: `mise exec -- pnpm ...`.
- Do not install dependencies unless a dependency manifest or lockfile changed, `node_modules` is missing or invalid, or the requested work otherwise requires it.
- When sandboxed, request approval to run dependency-installing or dependency-modifying commands outside the sandbox so pnpm can use the normal global store.
- Do not fall back to a sandboxed install or create a project-local `.pnpm-store`. If approval is denied, report the blocked installation instead of changing the store configuration.

### From repo root (all workspaces via Turbo)

- `mise exec -- pnpm build` — build all packages.
- `mise exec -- pnpm lint` — lint/type-check all packages.
- `mise exec -- pnpm test` — run all workspace tests.
- `mise exec -- pnpm format` — run formatting checks/tasks.
- `mise exec -- pnpm check-hygiene` — check unused deps, unresolved imports, circular deps, etc.

### Focused widget commands (recommended for most tasks)

- `mise exec -- pnpm --filter @stakekit/widget {command}`
- `mise exec -- pnpm --filter @stakekit/widget test:unit` — run the fast Node test project.
- `mise exec -- pnpm --filter @stakekit/widget test:dom` — run React/DOM tests in jsdom.
- `mise exec -- pnpm --filter @stakekit/widget test:browser` — run the Chromium test project.
- `mise exec -- pnpm --filter @stakekit/widget test:changed` — run affected Node + jsdom tests.
- `mise exec -- pnpm --filter @stakekit/widget test:changed:all` — run all affected projects, including Chromium.

## Agent Working Guidelines (short)
- Keep public API compatibility in `src/index.package.ts` and `src/index.bundle.ts`.
- React Compiler is enabled. Do not add `useMemo`, `useCallback`, or `React.memo` only for render-performance optimization; prefer plain values/functions.
- Treat React as the view layer. Put new or materially refactored business state, transitions, asynchronous work, retries, concurrency, and resource lifetimes in Effect and Effect Atom; React should read Atom state and dispatch user intent.
- Use `useEffect` only for unavoidable React, DOM, or third-party lifecycle boundaries that cannot be expressed safely with scoped Effects or lifecycle Atoms. Do not use it for data fetching, duplicated-state synchronization, workflow advancement, or domain-resource cleanup.
- Local synchronous presentation state may remain in React when it has no domain meaning, asynchronous behavior, persistence, route lifetime, or cross-component coordination, such as focus, hover, disclosure, or element refs.
- React may mount a lifecycle Atom when a resource follows view or route visibility, but acquisition, interruption, and finalization stay inside Atom/Effect. Widget-runtime resources must be scoped to the runtime rather than component effects.
- Keep React event handlers synchronous: normalize the UI event and dispatch an Atom command. Do not call `Effect.runPromise`, await asynchronous work, coordinate retries or state transitions, or clean up domain resources in the handler.
- Keep deterministic domain constructors, transitions, invariant checks, and projections as plain TypeScript. Use Atom for reactive state and commands, and Effect for typed asynchronous work, dependencies, concurrency, and scoped resources.
- Feature facades should expose read-only view Atoms and writable command Atoms while keeping mutable storage private. React convenience hooks must be zero-logic adapters rather than places for derivation, variant branching, or orchestration.
- Effect-backed resources and command Atoms own loading, typed failure normalization, retry eligibility, and stale-result suppression. React renders the published state and dispatches Retry; it does not catch promises, normalize raw errors, or maintain duplicate loading flags.
- Enforce these boundaries with architecture or hygiene tests: application-logic modules must not import React, and touched view adapters must not use `useEffect`. Any unavoidable external lifecycle exception must be isolated in a named boundary adapter and explicitly allowlisted.
- Prefer a scoped Effect exposed through an Atom lifecycle for the document-level Widget Instance claim. If React mount semantics require a hook bridge, isolate and allowlist one embedding-boundary hook that only acquires/releases the claim and contains no wallet or feature logic.
- Do not introduce React Query, hook-owned fetches, or Promise caches for new or materially refactored feature resources. Use Effect services/resources exposed through Atom; leave unrelated existing React Query usage unchanged unless it is in scope.
- Run feature Effects through the existing scoped application or wallet Atom runtimes and injected Effect services. Feature code must not create ad hoc runtimes or call `Effect.runPromise`; runtime generations own interruption and cleanup.
- Prefer headless Effect services over React-only third-party APIs. When no headless API exists, isolate the hook in a named boundary adapter that normalizes external values/callbacks into Atom; keep decisions, sequencing, errors, and non-library cleanup in Effect/Atom.
- Classic Transaction Flow code follows `packages/widget/src/features/transaction-flow/ARCHITECTURE.md`. Do not refresh a legacy-effect or reviewed-boundary hash merely to make `lint:architecture` pass; remove the legacy exception or re-review the external boundary.
- When changing user-facing copy, update both:
  - `packages/widget/src/translation/English/translations.json`
  - `packages/widget/src/translation/French/translations.json`
- After changes, run the lint command to check lint and type errors.

## Useful Context for Debugging
- API client is configured in `packages/widget/src/providers/api/api-client-provider.tsx`.
- React Query defaults are in `packages/widget/src/providers/query-client/index.tsx`.
- App-level config/env mapping is in `packages/widget/src/config/index.ts`.
- Test bootstrapping + MSW worker setup:
  - `packages/widget/tests/utils/setup.browser.ts`
  - `packages/widget/tests/mocks/worker.ts`

## Vendored Repositories

This project vendors external repositories under `@repos/`.

- Use vendored repositories as read-only reference material when working with related libraries
- Prefer examples and patterns from the vendored source code over generated guesses or web search results
- Do not edit files under `@repos/` unless explicitly asked
- Do not import from `@repos/` - application code should continue importing from normal package dependencies
- `@repos/effect` is a local-only clone of Effect-TS/effect-smol and may be ignored by Git locally
- When searching `@repos/`, use `rg --no-ignore <pattern> @repos/<repo>` so ignored local reference repositories are included without searching unrelated ignored directories
- Before writing any Effect code, inspect `@repos/effect/LLMS.md`
- Before writing code that interacts with Effect `HttpClient`, inspect `agent-patterns/effect-http-client.md`
- Before writing code that uses Effect `Stream`, inspect `agent-patterns/effect-stream.md`
