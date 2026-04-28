# StakeKit Widget — Agent Guide

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
- `packages/widget/tests/*` — Vitest browser tests (MSW-backed).
- `packages/examples/*` — integration examples (`with-vite`, `with-vite-bundled`, `with-nextjs`, `with-cdn-script`).

## Commands Agents Should Use

### From repo root (all workspaces via Turbo)
- `pnpm build` — build all packages.
- `pnpm lint` — lint/type-check all packages.
- `pnpm test` — run all workspace tests.
- `pnpm format` — run formatting checks/tasks.

### Focused widget commands (recommended for most tasks)
- `pnpm --filter @stakekit/widget {command}`

## Agent Working Guidelines (short)
- Keep public API compatibility in `src/index.package.ts` and `src/index.bundle.ts`.
- When changing user-facing copy, update both:
  - `packages/widget/src/translation/English/translations.json`
  - `packages/widget/src/translation/French/translations.json`
- After changes, confirm nothing is broken with lint command which checks lint/type errors

## Useful Context for Debugging
- API client is configured in `packages/widget/src/providers/api/api-client-provider.tsx`.
- React Query defaults are in `packages/widget/src/providers/query-client/index.tsx`.
- App-level config/env mapping is in `packages/widget/src/config/index.ts`.
- Test bootstrapping + MSW worker setup:
  - `packages/widget/tests/utils/setup.ts`
  - `packages/widget/tests/mocks/worker.ts`

<!-- opensrc:start -->

## Source Code Reference

Source code for dependencies is available in `opensrc/` for deeper understanding of implementation details.

See `opensrc/sources.json` for the list of available packages and their versions.

Use this source code when you need to understand how a package works internally, not just its types/interface.

### Fetching Additional Source Code

To fetch source code for a package or repository you need to understand, run:

```bash
npx opensrc <package>           # npm package (e.g., npx opensrc zod)
npx opensrc pypi:<package>      # Python package (e.g., npx opensrc pypi:requests)
npx opensrc crates:<package>    # Rust crate (e.g., npx opensrc crates:serde)
npx opensrc <owner>/<repo>      # GitHub repo (e.g., npx opensrc vercel/ai)
```

<!-- opensrc:end -->