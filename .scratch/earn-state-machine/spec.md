# Earn State Machine Contract and Verification

Status: implemented

## Problem Statement

`packages/widget/src/features/earn/state/atoms-state/` is the application-state boundary that combines user intent, widget configuration, Wallet Scope, and several Authoritative Resources into the selection and form consumed by Earn UI. Its behavior is currently covered only in fragments. Important branches are unverified, several loading and failure cases are collapsed into empty data, and some stale or invalid intent can survive behind a fallback projection.

The module needs an explicit behavioral contract and an exhaustive verification campaign. Tests must prove selection precedence, transition resets, data composition, loading and failure semantics, pagination, retry, refresh, race handling, and capability derivation. When the tests expose behavior that violates this specification, the implementation is corrected in the same effort and the correction is recorded here.

## Architectural Boundary

Earn state owns:

- User intent and deterministic transitions.
- Resolution of Earn Selection from intent and authoritative facts.
- Dependency-aware loading, empty, readiness, and blocking-failure state.
- Reconciliation of invalid selection after authoritative success.
- Stage-targeted first-load retry commands.
- Domain validation represented by `can.*` capabilities.

Authoritative Resources continue to own canonical remote reads, semantic request identity, caching, pagination, refresh, typed resource failure, semantic invalidation, and stale-result suppression as required by ADR-0008.

Earn projections consume typed Authoritative Resource results and never inspect HTTP causes directly. Optional preferred-token enrichment treats a failed Legacy token-directory lookup as a missing preference candidate without changing that resource's canonical error contract. Requested initialization lookups remain blocking when their required first acquisition fails.

The view resolver observes keyed resources lazily in dependency order and normalizes each `AsyncResult` exactly once. Independent initialization and positions reads begin together to avoid a loading waterfall. A usable observation retains its waiting flag so same-key refreshes remain visible without becoming blocking acquisition states. The published view contains normalized token, yield, and positions snapshots; React receives operational atoms only for pagination. Blocking failures carry the already-resolved atom that Retry must refresh.

`EarnYield` response decoding owns Earn Mechanic Argument projection and validation before authoritative yield facts reach this machine. Every field first decodes through the generated API schema, then the typed API field array resolves to a name-keyed domain record containing only `amount`, `providerId`, `tronResource`, `validatorAddress`, `validatorAddresses`, and `subnetId`. Consumed fields validate the canonical Yield API variants: `amount`, `providerId`, `validatorAddress`, and `validatorAddresses` use type `string`; `tronResource` uses `enum`; and `subnetId` uses `number`. The domain values retain only Widget-consumed required flags, amount bounds, and options rather than wire-only `name`, `type`, or label metadata. Every argument container (`enter`, `exit`, each `manage` action, and `balance`) uses the same projection. The Widget trusts the API contract to provide unique argument names. Valid unrelated fields are projected away; a malformed API field or invalid consumed domain value rejects that yield at the response seam.

React is a view adapter. It reads the resolved view and dispatches synchronous user commands as required by ADR-0004. It does not reconstruct loading, failure, retry, or domain-validity policy from raw resource flags.

Both classic and dashboard adapters render blocking `failed` with the shared error treatment and machine Retry command, suppress invalid downstream controls, and disable the CTA. A non-blocking refresh failure retains stale controls and may show a compact warning without replacing the page or activating machine Retry. Successful `no-*` states retain empty treatment and are never rendered as failures.

## Domain Terms

The canonical terms are defined in `CONTEXT.md`:

- **Earn Selection** is the resolved category, token, yield, validators, and form.
- **Earn Initialization** is the one-time seeding of the first selection from init parameters.
- **Earn Readiness** means every fact needed for correct selection and submission eligibility has a usable value.
- **Wallet Scope Owner** is network plus primary address; additional addresses are not owner identity.

## Machine Invariants

1. The published selection is valid against the latest successful authoritative facts for the active semantic inputs.
2. A transport or server failure without a usable value is never represented as a successful empty result.
3. Waiting or failed refresh with a prior successful value preserves that value and does not end Earn Readiness.
4. A successful result that removes a selection reconciles and commits a valid fallback; stale hidden intent cannot later snap the selection back.
5. `ready` is published only when every input needed for correct initial selection and submission eligibility has a usable value.
6. A selected yield's consumed mechanic arguments have already decoded into valid domain constraints and options.
7. A yield requiring validator selection has at least one valid selected validator before it is ready.
8. Results from obsolete wallet owners, configuration, categories, tokens, yields, validators, pagination keys, or searches never alter the active view.
9. Earn Initialization runs at most once per Widget Instance.
10. A Wallet Scope Owner change resets intent but does not rerun Earn Initialization.
11. A prior successful value is usable during waiting or refresh failure only when the complete semantic resource key is unchanged.

## Lifecycle and Reset Rules

### Wallet resolution

While wallet resolution is pending, the machine publishes `resolving-wallet`, starts no new owner-scoped loads, disables selection and submission capabilities, and retains the prior view snapshot when one exists. The first pending resolution uses an empty snapshot.

After resolution settles:

- The same Wallet Scope Owner continues with existing intent.
- A changed primary address or network resets the complete Earn intent to its default state, then resolves from current authoritative facts without applying Earn Initialization again.
- An additional-address-only change retains intent and refreshes or re-resolves dependent balances and positions.

### Configuration changes

- Preference, category-order, and `tokensForEnabledYieldsOnly` changes use new semantic resource keys and reconcile existing intent when possible.
- Validator allow/block/preference configuration changes re-project the canonical validator facts and reconcile any selection that is no longer eligible.
- Switching between classic and category-grouped dashboard modes resets category, token, and every downstream selection and form field.
- Reordering categories does not override an explicit category that remains available.
- Configuration changes never reactivate consumed Earn Initialization.

### User transitions

- Re-selecting the same effective category, token, or yield is idempotent.
- Changing category resets token, yield, validators, provider, amount provenance, and Tron resource.
- Changing token resets yield, validators, provider, amount provenance, and Tron resource.
- Changing yield resets validators, provider, amount provenance, and Tron resource.
- Clearing a selection is explicit user intent and cannot reactivate initialization.
- Provider, validator, amount, and Tron commands change only their own field.
- Automatic reconciliation commits through the same reset graph as explicit changes: a reconciled category resets token and downstream state, a reconciled token resets yield and form state, and a reconciled yield resets validators and form state.

## Dependency and Status Model

The public status vocabulary is:

- `resolving-wallet`
- `loading-categories`
- `no-categories`
- `loading-initial-selection`
- `loading-token-options`
- `no-tokens`
- `loading-yields`
- `no-yields`
- `loading-positions`
- `loading-validators`
- `no-validators`
- `ready`
- `failed`

When several required inputs are waiting, status uses this dependency order: wallet, categories, initialization, token options, yields, positions, validators. Acquisition may run safely in parallel even though the published status has deterministic priority.

`failed` carries one highest-priority discriminated failure:

- `ResourceFailure` identifies `categories`, `initial-selection`, `token-options`, `yields`, `positions`, or `validators`, preserves the typed catalog error and raw diagnostic cause, and exposes a Retry command for only the responsible resource.

The failure is used only when a required first acquisition has no usable value. Retry ignores duplicate commands while its target is waiting. If recovery reveals an independent downstream failure, that failure then becomes active according to dependency priority. A malformed directly requested yield is an ordinary decode-backed resource failure; a tolerant directory omits only the malformed yield and records the decode rejection.

A later refresh failure retains `ready` and its prior successful value. The responsible resource exposes the non-blocking error; machine-level blocking Retry is not activated.

Successful empty data uses the matching `no-*` status. It is not a failure and does not offer transport retry.

## Selection Resolution

### Category

- Classic mode always resolves `null`.
- Category-grouped dashboard mode waits for category discovery.
- An explicit or one-time initialized category is accepted only when discovered as available.
- Otherwise, the first discovered category in configured order is selected.
- Successful discovery with no categories resolves `null` and publishes `no-categories`; the machine does not invent a category.
- A category is available when its bounded maximum-size first-page summary defined by ADR-0008 contains at least one enter-enabled yield on a supported network. Earn state does not complete the category catalog to prove existence; if bounded discovery becomes insufficient, the resource contract must move to a dedicated summary endpoint. Reward rate affects ranking, not visibility.

### Token

Token precedence is:

1. Valid explicit user selection.
2. One-time init-yield token.
3. One-time init token, matching exact canonical token key first and then case-insensitive symbol plus network.
4. Preferred token configured for the active network.
5. First merged token option.

When disconnected, the first configured network may seed a default. When an active wallet network exists without preferences, preferences from another network are not used.

A configured preferred-token candidate is resolved during initial selection from the complete Legacy token directory response, then intersected with the same API-key and category yield scope before merging. The demand-driven paginated Yield token directory is not eagerly completed to find preferences, and a token discovered only by later browsing does not auto-switch a ready selection.

Merged token options:

- Deduplicate by canonical token key.
- Union, deduplicate, and sort available yield IDs.
- Prefer balance values and metadata over init, and init over default.
- Rank positive-balance tokens, init-only tokens, zero-balance tokens, then default-only tokens while preserving source order within each rank.
- Apply category scope to every candidate and remove a token left with no yield IDs.
- When `tokensForEnabledYieldsOnly` is active, intersect yield IDs from every source, including balance and initialization, with the authoritative enabled-yield scope. Initialization cannot bypass API-key product configuration; an excluded init target is consumed as unavailable and falls back.
- On initial connected-wallet acquisition, default discovery, balances, requested init data, and category scope must all settle before the result is authoritative.
- Token provenance is distinct from balance knowledge. Disconnected options have unknown available amount. After a successful connected-wallet scan, a returned amount is authoritative and an otherwise selectable token absent from the scan has known amount `"0"`; waiting or first-load failure leaves the machine unready rather than fabricating zero.

### Yield

Yield precedence is:

1. Valid explicit user selection.
2. One-time valid init yield.
3. Preferred yield for the selected token's network and canonical token key.
4. First yield eligible under balance, positions, and init constraints.
5. First non-zero-reward yield, then first available yield.

Preferred value `"*"` delegates to eligibility and default ranking. Preferences from another network are not used.

Yield visibility is determined by API-key-scoped data, enter capability, and supported network. The legacy hard-coded exclusions for Binance BNB and AVAX native staking are removed from both the state resolver and still-live Earn provider/yield helper resources. Zero reward does not hide a yield in state or React selectors; reward affects default ranking only.

### Validators

- Authoritative Resources retain raw canonical validators. Earn state applies network or wildcard allow/block/preference configuration and yield-specific eligibility before selection, empty-state, readiness, and capability decisions; React does not filter a second time.
- Preferred-validator acquisition and the first default-validator page both settle before readiness because either can change the correct initial selection.
- Single-select replaces the selection.
- Multi-select toggles membership but cannot remove the final validator.
- Explicit removal is a no-op for the final validator.
- After authoritative refresh, retain the valid selected subset. If none remain, choose a still-valid one-time init validator, then the first preferred validator, then the first active validator.
- Successful required-validator acquisition with no validators publishes `no-validators`.
- Search results have independent keyed pagination, pass through the same eligibility projection, and do not reorder or replace the default loaded list.
- A selected search result may be remembered by the base validator resource.

### Initialization targets

- Syntactically invalid init parameters decode to absence before reaching Earn state.
- A well-formed target that resolves as unavailable or disabled is consumed and falls back normally. Transport, server, and decode failures for requested initialization data remain blocking first-load failures.
- A transport or server failure while resolving a requested target is a blocking first-load `initial-selection` failure with retry.
- Account-targeted initialization is not consumed while the wallet owner is absent. Committing a resolved fallback and consuming initialization are separate transitions, so initial wallet connection can reset intent and resolve the same one-time target for its owner without re-arming initialization later.
- Once a yield target is committed, its ID remains a resource seed while selected so transient catalog re-keying cannot replace it with a fallback.
- A consumed, invalidated, or user-overridden target cannot resurrect.
- A successful bounded directory result may explicitly omit requested IDs. Omitted IDs are unavailable selections, not transport failures; explicit intent is reconciled and init intent emits its one diagnostic before fallback.

## Form Resolution

### Provider and Tron arguments

- Explicit values are accepted only if present in the selected yield's advertised options.
- Optional arguments default to `null`.
- Required arguments default to the first advertised option.
- No value such as `ENERGY` is hard-coded outside advertised options.
- `providerId` options decode as `YieldId`; `tronResource` options decode as `TronResource`.
- A required argument without an advertised option, an invalid option, or an unexpected field type rejects the yield during response decoding.
- Refreshed yield metadata reconciles stale option values.

### Amount

Amount intent has internal provenance:

- `untouched` resolves to the yield minimum.
- `manual` preserves the normalized user value, including zero.
- `max` preserves the calculated maximum snapshot for an ordinary yield.
- A force-max yield always derives from the latest available balance and ignores prior manual/max amount.
- Category, token, yield, or Wallet Scope Owner reset returns amount provenance to `untouched`.
- When refreshed yield, position, or balance facts change constraints, `untouched` follows the new minimum, while `manual` and ordinary `max` values remain unchanged and may make `can.submit` false. Enumerated provider and Tron values reconcile to advertised options; user-authored numeric input is not silently rewritten.
- Numeric amount constraints decode as exact finite decimal strings. Missing or null minimum becomes `"0"` and missing maximum becomes `null`; explicit maximum `"0"` retains its unbounded meaning. A maximum of `"-1"` with a non-negative minimum is the Yield API's unbounded-maximum sentinel and normalizes to `null`, while the complete `"-1"`/`"-1"` pair denotes force-max. A negative minimum outside that pair, another negative maximum, or a positive maximum below minimum rejects the yield during response decoding rather than allowing coercion or `NaN`.

The public form may continue exposing `stakeAmount` and `useMaxAmount`; provenance can remain private.

## Capabilities and Validation

Selection capabilities are enabled when their corresponding authoritative options exist and their own dependency is usable. They remain enabled during later pagination or non-blocking refresh. Blocking failures are stage-aware rather than global: category failure removes category-dependent controls; token failure may retain known category choices; yield failure may retain category and token choices; positions or validator failure may retain category, token, and yield choices. Submission and only the controls depending on the failed stage are disabled, so choosing a different upstream option is a valid recovery path alongside Retry.

`can.submit` requires:

- `ready` status.
- A connected Wallet Scope Owner.
- Valid token and yield selections.
- Every required validator, provider, and Tron value.
- Non-zero amount satisfying yield minimum and maximum.
- Amount not exceeding known available balance.
- A resolved balance for force-max yields.

KYC, gas checks, and transaction-execution readiness remain outside this machine. Plain amount and form validation is shared with the UI so the application has one definition.

## Pagination, Refresh, and Concurrency

- First-page failure without a usable value is blocking.
- Loading more preserves accumulated items and readiness.
- Later-page failure preserves accumulated items and exposes a non-blocking error.
- Repeating Pull after a later-page failure may retry the same continuation while preserving accumulated items.
- Explicit resource Refresh or Retry restarts the shared Pull from page one, as required by ADR-0008. Machine-level Retry is present only for blocking first-page failure.
- Duplicate items across pages merge by canonical identity.
- Repeated Pull while waiting is ignored.
- Validator search pagination is keyed by normalized search and cannot publish obsolete results into a newer search.
- Explicitly selected search validators may be remembered without changing default-list order.
- Every result is keyed by all semantic inputs.
- Same-key refresh may retain a previous successful value. A changed semantic key clears downstream old-key selection and publishes the new key's loading state; old-key data is never presented as stale data for the new request.
- Late results for obsolete wallet owner, configuration, category, token, yield, validator, or search cannot affect the active view.
- Revisiting a prior semantic key may immediately use its cached successful value under the Authoritative Resource's freshness and invalidation policy. Revisiting alone does not force a fetch.

## Verification Strategy

Tests use four seams:

1. Schema-boundary tests for Earn Mechanic Argument projection, normalization, rejection, tolerant directory omission, and direct-opportunity decode failure.
2. Pure decision tables for reducers, resolvers, validation, precedence, and invariants.
3. Atom-registry integration tests with controllable service Layers and deferred responses for loading, failure, retry, refresh, pagination, reconciliation, and races.
4. A small set of DOM/browser tests proving critical states and commands are consumed correctly by both classic and dashboard UI adapters, including blocking retry recovery and stale-data refresh failure.

Verification is complete when:

- Every action and meaningful resolver branch is asserted.
- Every status and capability combination is exercised.
- Initial, waiting, waiting-with-value, success, empty, typed failure, refresh, recovery, pagination, and out-of-order completion are covered.
- Input cross-products are used where inputs genuinely interact.
- Folder-scoped coverage may be inspected to find untested behavior, but no coverage percentage is a completion target or delivery gate.
- Focused unit and DOM tests, affected browser tests, widget lint/type checking, and hygiene checks pass.

Property-test tooling is not added solely for this effort. Explicit Vitest decision tables and invariants are preferred with the current dependency set.

## Delivery

The change lands as one coherent internal cutover. Implementation proceeds test-first in small red/green/refactor steps across pure resolution, catalog projection, machine lifecycle, and UI adapters, but the branch does not retain parallel old/new machine authorities, temporary fallback behavior, or a compatibility facade for behavior this specification replaces. Focused tests run throughout; the completed cutover runs the full widget validation ladder.

## Expected Behavioral Corrections

Code inspection identified the following current behaviors that conflict with this specification and must be verified before correction:

- Token and yield acquisition failures can appear as `no-tokens` or `no-yields`.
- Positions, category, and validator failures can be treated as successful empty facts.
- `ready` can be published before positions or required validators resolve.
- Dashboard token loading can begin from an invented fallback category while discovery is pending.
- The declared `resolving-wallet` state is not reliably published.
- Invalid intent can remain hidden behind a fallback and later snap back.
- Init targets remain permanent fallbacks and can resurrect.
- Wallet Scope Owner changes do not reset complete Earn intent.
- Category changes do not reset token intent.
- Explicit zero amount is indistinguishable from untouched amount.
- Required Tron default is hard-coded instead of derived from advertised options.
- Provider and Tron intent is not reconciled against refreshed options.
- Final-validator removal semantics differ between toggle and explicit remove.
- Three yield IDs are hard-coded out of visibility despite API-key scoping.
- Zero reward can incorrectly remove a dashboard category from availability.
- React's yield selector independently filters zero-reward yields after state resolution.
- Still-live Earn provider/yield helper resources repeat the hard-coded yield exclusions outside `atoms-state`.
- Cross-network preference fallback can influence an active network.
- `can.submit` can be true for disconnected or otherwise invalid form state.

## Completed Correction Log

- First-load category, token, yield, position, and validator failures now publish structured blocking failures; refresh failures with a previous value retain readiness.
- Readiness now waits for categories, tokens, yields, positions, and both required-validator sources in dependency order.
- Wallet pending publishes `resolving-wallet` without starting owner-scoped work; address/network owner changes and classic/dashboard mode changes reset intent, while one-time initialization is never re-armed. Account-targeted initialization consumption waits for the initial wallet owner.
- Successful fallback selection is committed to canonical intent, and category changes reset token plus all downstream state.
- Explicit zero amount, connected-wallet balance knowledge, and truthful submission capability are modeled in state. Advertised provider/Tron options and coherent numeric constraints are decoded before state resolution.
- Earn Mechanic Arguments now resolve from API arrays into validated, name-keyed domain records. Resolver-owned `InvalidYieldContract` handling and its form failure stage were removed.
- Preferred token discovery uses the complete Legacy directory and treats optional preference lookup failure as missing; active-network selection never consumes another network's preference.
- Every token source is intersected with category and enabled-yield scope, and stale hard-coded yield exclusions were removed.
- Validator configuration is applied before selection/readiness and React no longer performs a second eligibility filter.
- Zero-reward, enter-enabled yields remain visible in category discovery and selectors.
- Catalog projections forward Refresh to the exact authoritative source, and classic/dashboard failure UI exposes the targeted retry.

This list becomes a completed correction log as focused tests reproduce each behavior and the implementation is fixed.

## Out of Scope

- Replacing or duplicating Authoritative Resource cache and pagination ownership.
- Introducing React Query, hook-owned fetching, Promise caches, or React-owned retries.
- Broad UI redesign, unrelated product copy, KYC policy, gas policy, or transaction execution changes.
- Preserving accidental `atoms-state` behavior when it conflicts with this contract.
- Adding support for multiple concurrently mounted Widget Instances.
