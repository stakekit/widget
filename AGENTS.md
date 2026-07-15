# StakeKit Widget - Agent Guide

## Project Overview
- Monorepo managed with `pnpm` workspaces + Turborepo.
- Main package is `@stakekit/widget` in `packages/widget` (React + TypeScript + Vite).
- Widget supports two entry modes:
  - React component export (`src/index.package.ts`)
  - Fully bundled renderer (`src/index.bundle.ts`)
- Runtime branches between classic widget and dashboard variant in `src/App.tsx`.

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
