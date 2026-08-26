# StakeKit Widget: Agent Guide

This is a pnpm-workspace/Turborepo monorepo. The main package is
`@stakekit/widget` in `packages/widget` (React, TypeScript, and Vite), published
as both a React component and a bundled browser renderer.

This file is operational guidance. The code and executable checks are the
source of truth for behavior.

## Read before changing code

| Work | Read |
| --- | --- |
| Ownership, dependency direction, and Module interfaces | `packages/widget/ARCHITECTURE.md` |
| Project vocabulary | `CONTEXT.md` |
| A decision that constrains the change | The relevant current file in `docs/adr/` |
| Effect APIs | `.repos/effect/LLMS.md`, then the exact upstream source or tests |
| Local issues, domain docs, and triage | `docs/agents/` |
| Publishing | `docs/releases.md` |

## Commands

Run pnpm through the version pinned by mise: `mise exec -- pnpm ...`.

- `pnpm --filter @stakekit/widget lint` — widget formatting and type checks.
- `pnpm --filter @stakekit/widget test:unit` — Node tests.
- `pnpm --filter @stakekit/widget test:dom` — jsdom tests.
- `pnpm --filter @stakekit/widget test:browser` — Chromium tests.
- `pnpm check-hygiene` — dependency-cruiser and Knip; run after changing the import graph.
- `pnpm lint` — all workspaces plus the root ast-grep rules.
- `pnpm check` — lint, hygiene, tests, and builds.
- `pnpm test:smoke` — built package consumption; requires a configured API key.

Install dependencies only when manifests, the lockfile, or the task require it.
Use the normal pnpm store rather than creating a project-local store.

Test project selection is filename-based: `*.browser.test.*` uses Chromium,
`*.dom.test.*` uses jsdom, and other tests run in Node.

## Working rules

- Treat architecture-check failures as design feedback. Do not add blanket or
  unused suppressions.
- React Compiler is enabled. Do not add `useMemo`, `useCallback`, or `React.memo`
  for render performance.
- Avoid nested ternaries and mutable bindings used to select values.
- Update English and French translation files together for user-facing copy.
- Treat `.repos/` as read-only reference material and never import from it.

## Documentation

- Before changing domain vocabulary or ADRs, follow `docs/agents/domain.md`.
- Before creating or updating local specifications, issues, or triage state,
  follow `docs/agents/issue-tracker.md` and `docs/agents/triage-labels.md`.

## Before finishing

Run the smallest relevant tests while working. Before handoff, run
`mise exec -- pnpm --filter @stakekit/widget lint`; also run
`mise exec -- pnpm check-hygiene` whenever modules moved, were added or deleted,
or their dependency edges changed. Scale up to `pnpm check` for broad or risky
changes.
