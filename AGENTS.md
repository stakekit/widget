# StakeKit Widget: Agent Guide

This is a pnpm-workspace monorepo with root tasks in `mise.toml`. The main
package is `@stakekit/widget` in `packages/widget` (React, TypeScript, and
Vite), published as both a React component and a bundled browser renderer.

This file is operational guidance. The code and executable checks are the
source of truth for behavior.

## Read before changing code

| Work                                                             | Read                                                                                                                                                                                       |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Ownership, dependency direction, and Module interfaces           | `packages/widget/ARCHITECTURE.md`                                                                                                                                                          |
| Project vocabulary                                               | `GLOSSARY.md`                                                                                                                                                                              |
| UI: screens, components, styling, theming, and the Design System | `docs/design-system.md`                                                                                                                                                                    |
| A decision that constrains the change                            | The relevant current file in `docs/adr/`                                                                                                                                                   |
| Effect APIs                                                      | Run `git submodule update --init .repos/effect` (pinned to the same release as the catalog `effect` version), then read `.repos/effect/LLMS.md`, then the exact upstream source or tests   |
| Local issues, domain docs, and triage                            | `docs/agents/`                                                                                                                                                                             |
| Backend API behavior                                             | The backend source, if available: resolve its path with `mise exec -- printenv YIELD_BACKEND_DIR` (set in the gitignored `mise.local.toml`). Otherwise the OpenAPI specs `gen:api` fetches |
| Publishing                                                       | `docs/releases.md`                                                                                                                                                                         |

## Commands

Run pnpm through the version pinned by mise: `mise exec -- pnpm ...`. Root
`pnpm <script>` commands alias the `mise run <task>` tasks in `mise.toml`.

- `pnpm dev` — the playground (`packages/widget/playground`): the widget
  mounted as a host against the real API, configured from its panel and the
  page link, with a scripted host wallet on `window.skDev`. See the README's
  Development section. API mocking belongs to tests only.
- `pnpm --filter @stakekit/widget lint` — one pass of oxlint and type checking
  on the Effect-patched tsrs (`effect-tsgo --tsrs-lint oxlint --type-check`):
  the type-aware rules, StyleX's rules on `src/ui`, the widget's rule plugins in
  `scripts/oxlint/`, and every TypeScript and Effect diagnostic of
  `tsconfig.json`, oxlint-ignored files included. `lint:fix` applies oxlint's
  fixes. Keep every TypeScript file in a package tsconfig: a file outside one is
  linted but not type-checked.
- `pnpm format` — formats the repository with oxfmt (`.oxfmtrc.json`), imports
  sorted; `pnpm lint:format` checks it.
- `pnpm --filter @stakekit/widget test:unit` — Node tests: the `unit` project
  and, for `*.isolated.test.*` files, `unit-isolated`.
- `pnpm --filter @stakekit/widget test:dom` — jsdom tests.
- `pnpm --filter @stakekit/widget test:browser` — Chromium tests.
- `pnpm --filter @stakekit/widget test:browser:diagnostic` — Chromium tests with trace replay in `packages/widget/.vitest/index.html`; serve that directory over HTTP to view the report.
- `pnpm --filter @stakekit/widget storybook` — Storybook for the Design System
  (`packages/widget/src/ui/**/*.stories.tsx`) on port 6006, with color scheme
  and Appearance Preset toolbars. `build-storybook` builds it into
  `packages/widget/storybook-static`.
- `pnpm --filter @stakekit/widget test:storybook` — every story as a Chromium
  test; accessibility violations, failed plays and console errors fail it.
  `pnpm test` and `pnpm check` include it.
- `pnpm check-hygiene` — dependency-cruiser, Knip, and jscpd duplication of
  source and of tests; run after changing the import graph or copying code
  between Modules. The tests' limit (`packages/widget/.jscpd-tests.json`) is a
  ratchet: lower it when duplication drops, never raise it to pass.
- `pnpm --filter @stakekit/widget gen:yield-providers` — regenerates the
  public `YieldProviderId` constants from the backend's yield provider enum,
  read from `YIELD_PROVIDERS_ENUM_PATH` (set in `mise.local.toml`) or
  `--source <enum file>`. Commit the regenerated file.
- `pnpm lint` — formatting, every workspace's oxlint and type checks, and the
  workflow checks (`lint:workflows`: actionlint with shellcheck, and zizmor's
  offline audits configured in `.github/zizmor.yml`).
- `pnpm check` — lint, hygiene, tests, and builds.
- `pnpm --filter @stakekit/widget check:host-bundlers` — checks that esbuild
  hosts such as Angular can resolve the built `dist`; part of `build`.
- `pnpm --filter @stakekit/widget check:stylex-css` — fails when the built
  package, bundle or website stylesheets hold no StyleX rules; part of `build`.
- `pnpm --filter @stakekit/widget check:bundle-size` — fails when the gzip size
  of an entry plus every chunk it imports statically exceeds its budget in
  `scripts/bundle-size/check-entry-size.ts`; part of `build`. Raise a budget
  only for an intended increase, in the same change.
- `pnpm test:smoke` — builds `dist` (`build:widget`), then builds the example
  hosts against it and loads them in Chromium with the API mocked by the
  widget's MSW fixtures. CI runs it instead of the examples `build`.

mise caches `lint:widget`, `lint:examples`, `lint:workflows`, `check-hygiene`,
`test:unit`, `test:dom`, `test:browser`, `test:storybook`, `build:widget`, and
`build` (`tools/mise/cached-tasks.toml`), so `pnpm lint`, `pnpm test`, and
`pnpm check` skip work whose inputs (the widget or example files, env files,
lockfile, and root configs) are unchanged, and restore results stored on any
branch or worktree. `build:widget` reads no tests but the packed-types
consumers and no stories, and `test:storybook` reads only `src/ui`, so editing
a test leaves the builds cached. `mise run --force <task>` reruns one;
`--task-cache off` ignores stored results. A new input, such as a widget file
outside the listed directories, belongs in the input groups in `mise.toml`.

Install dependencies only when manifests, the lockfile, or the task require it.
Use the normal pnpm store rather than creating a project-local store.

Test project selection is filename-based: `*.browser.test.*` uses Chromium,
`*.dom.test.*` uses jsdom, `*.isolated.test.*` runs in Node in a fresh worker
per file, and other tests run in Node in shared workers, so a module the files
have in common loads once per worker. A shared worker keeps module state
between files: a module mock (`vi.mock`, `vi.doMock`) belongs in an
`*.isolated.test.*` file (`widget/no-module-mock-in-shared-test`), and so does
a Node test that relies on MSW patching `fetch`, since Effect's
`FetchHttpClient` keeps the first `fetch` it sees. Chromium test files run
two at a time, each mocking the API in its own page through MSW's `fetch` and
`XMLHttpRequest` interceptors (`tests/mocks/network.ts`, no service worker);
Chromium resolves no host but the Vitest server, so images, fonts and scripts
never reach the real network.

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
