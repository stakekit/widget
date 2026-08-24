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
- Keep application logic out of React. Event handlers normalize input and
  dispatch commands; `useEffect` is reserved for React, DOM, or third-party
  lifecycle boundaries.
- Put multi-step orchestration, retry, rollback, concurrency, and workflow
  lifetimes in Atom-independent Effect modules. Use existing application or
  wallet runtimes and injected services; never construct an ad hoc runtime.
- Use Effect Atom for reactive composition, Resource binding, feature-local
  state, and adapters. A command Atom performs one local transition, one scoped
  handle operation, or one cross-feature tail delegation.
- Cacheable remote reads belong to authoritative Resources, including their
  identity, freshness, retry, invalidation, and stale-result policy.
- Keep deterministic constructors, transitions, invariants, and projections in
  plain TypeScript. Application-logic modules do not import React.
- Use Effect `DateTime`, `Duration`, and `Clock` for application time. Do not use
  native `Date` or `date-fns` in application logic.
- React Compiler is enabled. Do not add `useMemo`, `useCallback`, or `React.memo`
  for render performance.
- Avoid nested ternaries and mutable bindings used to select values.
- Update English and French translation files together for user-facing copy.
- Support one Widget Instance per browser document. Sequential unmount and
  remount is supported; concurrent instances are not.
- Keep `src/index.package.ts` and `src/index.bundle.ts` compatible. Host-facing
  types belong in `src/public-api/`, and internal modules never import an
  outbound entrypoint.
- Treat `.repos/` as read-only reference material and never import from it.

## Documentation

- Update an existing durable document when the fact it owns changes.
- `CONTEXT.md` owns domain vocabulary; `docs/adr/` owns only current, durable
  decisions and their rationale. Git history owns the decision timeline.
- Ask for human approval before creating a new durable document or document
  category. A new ADR also needs a hard-to-reverse, surprising decision with a
  real tradeoff.
- `.scratch/` is the active local specification and issue tracker. Its content
  is working state rather than durable product documentation; retention and
  removal after an effort are human-owned.
- Do not add feature-local `ARCHITECTURE.md` files. Stable package-wide
  boundaries belong in `packages/widget/ARCHITECTURE.md`; behavior belongs in
  code and tests.

## Before finishing

Run the smallest relevant tests while working. Before handoff, run
`mise exec -- pnpm --filter @stakekit/widget lint`; also run
`mise exec -- pnpm check-hygiene` whenever modules moved, were added or deleted,
or their dependency edges changed. Scale up to `pnpm check` for broad or risky
changes.
