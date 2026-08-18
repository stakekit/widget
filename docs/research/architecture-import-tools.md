# Import architecture tooling for the widget

Research date: 2026-08-18

> **Subsequent simplification:** The spike below records the original cutover.
> The final enforcement keeps dependency-cruiser and Knip as the two
> widget-owned graph-analysis tools. Native Knip production mode replaced the
> custom test-only comparison; ast-grep owns explicit Module-interface export
> syntax; and the separate source checker, architecture fixtures, root policy
> adapter, and dedicated policy TypeScript project were removed.

## Outcome

The repository adopted **dependency-cruiser + Knip** and removed rev-dep:

- dependency-cruiser owns every architectural dependency rule: the top-level
  layer matrix, feature ownership, the `index.ts` / `composition.ts` /
  `views.ts` / `runtime.ts` interfaces, importer-specific access to those
  interfaces, privileged generated/API imports, cycles, and unresolved imports;
- Knip owns unused files, exports, dependencies, unlisted dependencies, and
  optionally cycles.

This is preferable to a custom graph checker. dependency-cruiser has the one
capability the former rev-dep configuration was missing: a path segment captured
from the importer can be reused in the target matcher. Its own documentation
uses that feature to replace one rule per business component with one generic
ownership-relative rule ([group matching](https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md#group-matching)).

Do not adopt Nx for this purpose, and do not add ESLint solely for
`eslint-plugin-boundaries`. The latter has the best semantic policy model, but
in this Biome repository it would add another lint stack while still requiring
a second tool for graph hygiene.

The migrated production graph, valid/invalid architecture fixtures, required
Resource-interface check, Knip analysis, and test-only-export check pass. The
cutover does not meet the 20% performance goal and is accepted only through its
documented-new-defect-class exception:

| Hygiene suite | Wall time | Peak RSS |
| --- | ---: | ---: |
| Former rev-dep + test-only-export check | 2.47 s | 384 MB |
| Replacement, initial run | 11.00 s | 1.20 GB |
| Replacement, warm | 8.28 s | 1.31 GB |

The replacement newly detects generic future-Feature privacy without config
registration, nested-Module and Resource privacy, missing Resource interfaces,
importer-specific interface misuse, imports through a Module's own interface,
parent and cross-Module re-exports, non-headless exports from `index.ts`,
wildcard interface exports, type-only and dynamic dependency edges, and stale
hygiene entries or configuration. Production reachability is checked separately
so tests cannot keep otherwise-orphaned runtime files alive. During the cutover Knip also exposed
over-published Resource interfaces and stale entries in the former hygiene
configuration. These findings justify the larger runtime under ADR-0023's
explicit exception, but the higher memory and latency remain a real tradeoff.

## What the policy needs to express

The former `.rev-dep.config.jsonc` was 569 lines.
It contains two kinds of policy that should be unified, plus graph hygiene:

1. **Layer direction.** The existing `app`, `features`, `resources`, `services`,
   `domain`, `shared`, `generated`, and `public-api` rules are not secondary to
   feature APIs. They are the repository-wide dependency matrix and should move
   to the same architecture engine.
2. **Ownership and interfaces.** Code inside one feature may deep-import within
   that feature. Code outside it may import only a finite interface:
   `index.ts`, `composition.ts`, `views.ts`, and `runtime.ts`. `index.ts` is the
   non-rendering interface; `composition.ts` is for app or enclosing-module UI
   composition; `views.ts` is available to app, permitted peers, and outbound
   package entrypoints; `runtime.ts` is for app or enclosing-module runtime
   assembly. This rule must apply automatically to every existing and future
   feature. Resource modules publish a required `index.ts` interface.
3. **Restricted targets.** Generated clients, API transports/resource sources,
   and feature runtime services have narrower role-based audiences than their
   containing layer. They remain typed policy declarations rather than manual
   importer-to-target exceptions.
4. **Graph hygiene.** Cycles, unreachable/orphan files, unused exports and
   packages, missing/unlisted packages, and unresolved imports must continue to
   fail CI.

A finite policy model can therefore be represented as four small sections:

```text
layers       = dependency matrix for app/features/resources/services/domain/shared/generated/public-api
collections  = repeated owned modules, initially features/*
interfaces   = index | composition | views | runtime, including allowed importer kinds
restricted targets = stable audience roles narrower than their containing layer
```

Tests, CSS sidecars, generated files, and outbound package entrypoints should be
classified once and referenced by the policy, rather than repeated in every
feature rule.

## Capability comparison

Legend: **yes** means first-class support; **partial** means possible only with
extra projectization, static repetition, or another tool.

| Capability | dependency-cruiser | eslint-plugin-boundaries | Nx boundaries | Knip | rev-dep today |
| --- | --- | --- | --- | --- | --- |
| Same owner may deep-import; outsiders use fixed files | **Yes**, regex capture/group matching | **Yes**, captured element identity + `fileInternalPath` | Partial: only if every feature is an Nx project | No | Yes, but one repeated rule per feature |
| Importer-specific interfaces | **Yes**, `from`/`to` rules | **Yes**, entity selectors/policies | Partial: project tags, not arbitrary files | No | Yes, explicit allowlists |
| Layer direction matrix | **Yes** | **Yes** | **Yes**, at project granularity | No | **Yes** |
| Restricted generated/API importers | **Yes** | **Yes** | Partial: only project/package granularity | No | **Yes** |
| Cycles | **Yes**, module or folder scope | No graph-wide rule | Project cycles | **Yes**, optional | **Yes** |
| Orphans/unreachable files | **Yes**, `orphan` and `reachable: false` | No | No | **Yes**, entry-reachability model | **Yes** |
| Unused named exports | No | No | No | **Yes** | **Yes** |
| Unused/unlisted packages | Partial package checks | No | Partial transitive package checks | **Yes** | **Yes** |
| Unresolved imports | **Yes** | No dedicated rule | No replacement | **Yes** | **Yes** |
| TypeScript aliases/resolution | **Yes**, `tsConfig`; enable pre-compilation deps | **Yes**, with TS parser + resolver | **Yes**, through Nx project graph | **Yes**, TS paths and Oxc resolver | **Yes** |
| Fits Biome + pnpm + Turborepo without another linter | **Yes** | No; requires ESLint, or alpha Oxlint JS-plugin support | No; adds Nx and ESLint | **Yes** | **Yes** |

## Candidate analysis

### dependency-cruiser: best architecture-engine fit

dependency-cruiser is a standalone JavaScript/TypeScript dependency graph
validator. Rules have `from` and `to` conditions and may be expressed as
forbidden rules or as an allowlist
([rules reference](https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md)).
The important differentiator for this repository is group matching: a regex can
capture the current feature name in `from`, then use `$1` in `to.path` or
`to.pathNot`. That directly removes the 15 repeated feature privacy blocks and
automatically covers a sixteenth feature when its directory appears.

A representative rule shape is:

```js
{
  name: "feature-internals-are-private",
  severity: "error",
  from: { path: "^packages/widget/src/features/([^/]+)/" },
  to: {
    path: "^packages/widget/src/features/([^/]+)/",
    pathNot: [
      "^packages/widget/src/features/$1/",
      "^packages/widget/src/features/[^/]+/(index|composition|views|runtime)\\.ts$",
    ],
  },
}
```

A second generic rule covers importers outside `features/**`; importer-specific
rules reserve `composition.ts` for app or enclosing-module UI composition and
`runtime.ts` for app or enclosing-module runtime assembly. The layer matrix can
be generated from one JavaScript object into `from`/`to` rules. That generation
is configuration, not a custom dependency parser.

The tool natively supports circular, orphan, unresolvable, and reachability
conditions. `reachable: false` is specifically documented for detecting files
not reachable from legal roots
([orphans and reachability](https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md#orphans)).
It also supports folder-scoped cycles. This can reproduce both the ordinary
orphan check and the current "runtime file only reachable from tests" check,
although parity needs to be verified on the actual graph.

For TypeScript it reads compiler options, including inherited `tsconfig`
settings and paths. Architecture checks should enable `tsPreCompilationDeps` so
type-only imports participate in boundaries, matching the current conservative
policy
([TypeScript and resolution options](https://github.com/sverweij/dependency-cruiser/blob/main/doc/options-reference.md#matching-your-environment)).

Performance controls include persistent content/metadata caching,
`includeOnly`, and `skipAnalysisNotInRules`; the documentation says the default
resolver cache works well for roughly 5,000 modules / 20,000 dependencies and
notes that orphan analysis adds cost on large graphs
([performance options](https://github.com/sverweij/dependency-cruiser/blob/main/doc/options-reference.md#esoteric-options)).
It is mature and actively released; its official repository currently shows
about 7.1k stars
([repository](https://github.com/sverweij/dependency-cruiser),
[releases](https://github.com/sverweij/dependency-cruiser/releases)).

The hard limitation is symbol granularity. dependency-cruiser intentionally
models modules rather than individual classes/functions/exports, so it cannot
replace unused named-export analysis
([official FAQ](https://github.com/sverweij/dependency-cruiser/blob/main/doc/faq.md#q-does-dependency-cruiser-support-granularity-finer-than-modules-eg-classes-functions-variables-)).
That is why Knip remains necessary.

### eslint-plugin-boundaries: strongest policy language, weaker repository fit

The current project is `eslint-plugin-boundaries`/JS Boundaries. It models every
dependency as importer and target entities classified by architectural element,
file category, and module origin
([classification](https://www.jsboundaries.dev/docs/classification/)). Element
descriptors can capture the feature name, policy templates can compare the
target feature with the importer's captured feature, and `fileInternalPath` can
limit external access to the four interface files
([selectors](https://www.jsboundaries.dev/docs/selectors/),
[policy example using captured values](https://www.jsboundaries.dev/docs/policies/#complete-example)).
This is the cleanest expression of the desired contract.

It also directly supports the existing layer matrix and privileged importer
rules. Its rule overview even describes restricting cross-element imports to
defined entrypoints, now expressed through the canonical dependency policy
([rules overview](https://www.jsboundaries.dev/docs/rules/)).

However, it evaluates imports rather than a whole repository dependency graph.
Its active rule set contains dependency-policy and unknown/ignored-file rules,
not cycles, reachability, unused exports, or unused dependencies. TypeScript
also requires ESLint, `@typescript-eslint/parser`, and
`eslint-import-resolver-typescript`
([TypeScript setup](https://www.jsboundaries.dev/docs/guides/typescript-support/)).
It therefore needs Knip or another graph tool anyway and introduces an ESLint
pipeline into a Biome repository.

Oxlint can host the plugin and would reduce lint overhead, but Oxlint's generic
JavaScript-plugin support is explicitly alpha
([Oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)).
That is an interesting future route, not the conservative choice for an
architecture gate today.

The project is maintained and meaningfully adopted: the official repository
currently shows about 960 stars and current v7 documentation/releases
([repository](https://github.com/javierbrea/eslint-plugin-boundaries),
[releases](https://github.com/javierbrea/eslint-plugin-boundaries/releases)).

### Nx `@nx/enforce-module-boundaries`: wrong granularity

Nx defines dependency constraints between **projects**, selected by tags
([Nx boundary overview](https://nx.dev/docs/features/enforce-module-boundaries),
[rule options](https://nx.dev/docs/technologies/eslint/eslint-plugin/guides/enforce-module-boundaries)).
It handles layer direction well when each layer or feature is an Nx project, and
its lint rule prevents cross-project imports outside the root `index.ts` public
API while detecting project cycles
([public APIs and cycles](https://nx.dev/docs/troubleshooting/resolve-circular-dependencies)).

That does not match the current shape: `@stakekit/widget` is one workspace
package containing all features. To make Nx see each feature as an owner, the
repository would have to promote each feature to an Nx project and maintain
project tags/configuration. Its default single-root-`index.ts` public API also
does not naturally model the agreed `index` / `composition` / `views` /
`runtime` access levels. It provides no replacement for unused exports, unused
files, or unresolved imports, and the JavaScript rule requires ESLint. Nx's language-
agnostic Conformance alternative requires Powerpack or Enterprise
([official comparison](https://nx.dev/docs/features/enforce-module-boundaries)).

Nx is extremely mature and maintained on a published support schedule
([release policy](https://nx.dev/docs/reference/releases),
[releases](https://github.com/nrwl/nx/releases)), but adopting a second
monorepo orchestrator to solve an inside-one-package boundary problem is not a
good trade.

### Knip: best graph-hygiene companion, not an architecture engine

Knip reports unused files, dependencies, exports and types, duplicate exports,
unresolved imports, and optional circular dependencies
([issue types](https://knip.dev/reference/issue-types)). Its unused-file model
is reachability from configured entrypoints rather than merely "no incoming or
outgoing edges", which aligns well with the repository's production/test entry
distinction
([how Knip works](https://knip.dev/explanations/how-knip-works)).

It handles pnpm workspaces out of the box and reads `pnpm-workspace.yaml`
([monorepos](https://knip.dev/features/monorepos-and-workspaces)). It reads
TypeScript path mappings and uses Oxc parsing/resolution; Knip v6 explicitly
moved to that backend for single-pass performance
([configuration](https://knip.dev/reference/configuration#paths),
[Knip v6](https://knip.dev/blog/knip-v6)). It also offers persistent caching and
performance tracing
([performance](https://knip.dev/guides/performance)). The repository already
pins Knip 6.31.0, although it has no checked-in Knip configuration or script.

Knip deliberately does not prescribe code organization, so it cannot enforce
ownership-relative interfaces or the layer matrix. It is the companion that
fills dependency-cruiser's symbol-level gap, not a standalone replacement.
It is highly adopted and actively maintained; the official repository currently
shows roughly 12k stars
([repository](https://github.com/webpro-nl/knip)).

### rev-dep: comprehensive single pass, but the config cannot express the abstraction

rev-dep already covers the widest set in one run: module boundaries, restricted
direct/transitive importers, cycles, orphans, unused exports/dependencies,
missing dependencies, and unresolved imports. Its docs say config checks share
one dependency tree and run workspace checks in parallel
([official repository and configuration](https://github.com/jayu/rev-dep)).
This is why keeping it is defensible if minimizing tools is more important than
removing repetition.

The present problem is not missing analysis; it is missing policy abstraction.
Its public configuration uses glob-based `pattern`, `allow`, `deny`, `files`,
and `allowImporters`. There is no documented importer-path capture/template
equivalent to dependency-cruiser's `$1` or JS Boundaries' captured values. As a
result, the current config must name every feature. The local repository has 15
feature directories and the feature-specific blocks occupy most of the config.

rev-dep is active but much less widely adopted than the alternatives; its
official repository currently shows about 252 stars
([repository](https://github.com/jayu/rev-dep)). This is not itself a reason to
migrate, but it weakens the argument for accepting a growing proprietary policy
shape when mature generic engines exist.

### Other nearby tools

- `eslint-plugin-import-x` provides static restricted zones plus cycle and
  unresolved-import rules, but zones are fixed `target`/`from` paths and do not
  offer the ownership-relative captured identity needed here
  ([`no-restricted-paths`](https://github.com/un-ts/eslint-plugin-import-x/blob/master/docs/rules/no-restricted-paths.md)).
  It also adds ESLint and does not replace Knip's dead-code analysis.
- The already-installed Turborepo has `turbo boundaries`, but it operates on
  package-manager workspaces and package tags, not owned folders inside the
  widget package. The command remains explicitly experimental
  ([command reference](https://turborepo.dev/docs/reference/boundaries),
  [support policy](https://turborepo.dev/docs/support-policy)).

Neither is a stronger fit than dependency-cruiser for this repository.

## Adopted tooling ownership

The tooling boundaries are:

| Concern | Owner |
| --- | --- |
| Layer direction (`app`, `features`, `resources`, `services`, `domain`, `shared`, `generated`, `public-api`) | dependency-cruiser |
| Generic feature privacy and `index` / `composition` / `views` / `runtime` access | dependency-cruiser |
| Restricted generated clients, transport, resource sources, runtime services | dependency-cruiser |
| Module/folder cycles and unresolved imports | dependency-cruiser |
| Unused files, exports, types, dependencies, unlisted dependencies | Knip |
| Production reachability through tests | Knip production mode |
| Semantic source rules (Effect runtime, native Date, fetch, React boundaries, explicit interface exports, etc.) | ast-grep/Biome |

Knip can also report cycles and unresolved imports. Initially keep those checks
in dependency-cruiser because they are part of the same graph that validates
architecture and provide clearer dependency paths. After benchmarking, avoid
running duplicate checks unless the tools catch meaningfully different cases.

## Spike results

1. The eight top-level layer rules are encoded as one data matrix that generates
   dependency-cruiser rules.
2. Feature privacy has no feature-name enumeration. Fixtures prove a new Feature
   is covered without config edits.
3. Fixtures prove the four interface cases: app or an enclosing module may use
   `composition`; app or an enclosing runtime may use `runtime`; a permitted
   peer may use `views`; and ordinary external callers use `index`. All deep
   imports fail while same-feature deep imports pass.
4. Generated/API/runtime audiences are represented as stable architectural
   roles with no manual importer-to-target exceptions.
5. Knip entrypoints distinguish outbound package exports from internal exports;
   its findings were classified during migration.
6. Both suites were run against the same pre-migration commit. The measurements
   are recorded in the outcome table above.
7. Every current policy has an explicit owner. The replacement is slower than
   the 20% target, so the cutover uses the documented-new-defect-class exception
   listed above. Overlapping rev-dep rules were removed.
