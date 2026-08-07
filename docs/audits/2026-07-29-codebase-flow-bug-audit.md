# Codebase and Application Flow Bug Audit

Date: 2026-07-29<br>
Baseline commit: `f71768da44aef23aa28a72f9cd00e1d63a098f17`<br>
Branch at audit time: `feat/earn-effect-atom-poc`<br>
Status: High-severity Borrow findings resolved; remaining backlog open

## Purpose

This document records the findings from a three-agent, risk-first audit of the
StakeKit Widget. The audit traced application behavior through Wallet Scope,
Earn, Classic Transaction Flow, Borrow Transaction Flow, Transaction Workflow,
Activity, Portfolio, Position Details, Authoritative Resources, runtime
lifecycle, and the bundled public API.

The findings below are separated into confirmed bugs and design risks. A
confirmed bug had either a deterministic reproduction, an existing failing
test, or a reachable contradiction with a documented invariant. Temporary
audit-only tests were removed after reproduction.

## How to use this backlog

For each finding:

1. Change its status from `Open` to `In progress`.
2. Add a permanent regression test that fails on the reported behavior.
3. Apply the smallest fix at the owning module boundary.
4. Run the finding's targeted tests.
5. Run `mise exec -- pnpm --filter @stakekit/widget lint`.
6. Run `mise exec -- pnpm check-hygiene` if the import graph changed.
7. Change the status to `Resolved` and record the fixing commit or PR.

Do not close a finding based only on code inspection. Its regression test must
exercise the real failing seam.

## Summary

| ID | Severity | Area | Finding | Status |
| --- | --- | --- | --- | --- |
| BOR-001 | High | Borrow | Market enablement and minimum-loan constraints are ignored | Resolved |
| BOR-002 | High | Borrow | Catalog refresh can silently substitute market and collateral selections | Resolved |
| BOR-003 | High | Borrow | Projected risk uses one selected/default collateral limit | Resolved |
| ACT-001 | Medium | Activity / Classic Flow | Successful historical Activity details redirect home | Resolved |
| EARN-001 | Medium | Earn | Earn Initialization can reapply after Wallet Scope Owner change | Resolved |
| POS-001 | Medium | Position Details | Stale Exit/Manage commands can mix Wallet Scope Owners | Resolved |
| POS-002 | Medium | Position Details / Yield Entry | Cosmetic price loading blocks staking submission | Resolved |
| BOR-004 | Medium | Borrow domain | Non-collateral supplies influence fallback risk metrics | Open |
| BOR-005 | Medium | Borrow Flow | Execution start resets the wrong position-action form | Open |
| API-001 | Medium | Bundled public API | Immediate `rerender()` throws before React commits | Resolved |
| BAL-001 | Medium | Resources / Transaction Workflow | Additional-address changes can miss balance invalidation | Open |
| ACT-002 | Medium | Activity | Canceled and stale Activity rows open blank details | Resolved |
| PORT-001 | Low | Portfolio | Earn failure can be presented as an empty portfolio | Open |

## Recommended resolution order

1. `BOR-001`, `BOR-002`, and `BOR-003` — prevent invalid or silently changed
   transaction intent.
2. `POS-001`, `ACT-001`, and `EARN-001` — restore Wallet Scope and journey
   lifecycle invariants.
3. `POS-002`, `BOR-004`, and `BOR-005` — unblock actions and correct Borrow
   projections and reset behavior.
4. `API-001`, `BAL-001`, `ACT-002`, and `PORT-001` — lifecycle, freshness, and
   presentation correctness.

---

## BOR-001 — Market enablement and minimum-loan constraints are ignored

Severity: High<br>
Status: Resolved<br>
Confidence: High<br>
Resolution: `b5b0886b6fcd8c2ff0a1730e7cc03913a1653371`

### Behavior

The Borrow form can publish a ready Review for:

- a borrow on a market where `isBorrowEnabled` is false;
- a new debt amount below `minLoan`;
- a partial repayment that leaves non-zero debt below `minLoan`.

The generated API contract states that the latter two cases revert on-chain.
The user can therefore reach action creation, signing, or submission for a
request the application already has enough information to reject.

### Evidence

- `packages/widget/src/generated/api/borrow.ts:1713` documents
  `isBorrowEnabled`.
- `packages/widget/src/generated/api/borrow.ts:1727` documents `minLoan` and
  its on-chain behavior.
- `packages/widget/src/features/borrow/model/borrow-form.ts:375` derives action
  readiness without either constraint.
- `packages/widget/src/features/borrow/model/position-action-form.ts:153`
  derives repayment eligibility without checking the remaining debt floor.

The audit reproduced all three cases with focused model tests; all three
incorrectly reported ready/submittable.

### Fix direction

Keep the rules in the Borrow domain/model layer:

- exclude borrow-disabled markets from new Borrow discovery, defaults, and
  dashboard actions;
- keep existing positions visible and manageable even when their market is no
  longer enabled for new borrowing;
- reject positive new debt below `minLoan`;
- allow full repayment to zero;
- reject a partial repayment when the positive remainder is below `minLoan`;
- publish explicit validation reasons for the UI.

### Acceptance criteria

- [x] Borrow-disabled markets are excluded from new dashboard actions.
- [x] Existing positions remain visible and manageable when their market is
      borrow-disabled.
- [x] New positive debt below `minLoan` cannot enter Review.
- [x] Full repayment to zero remains allowed.
- [x] Partial repayment leaving positive debt below `minLoan` cannot enter
      Review.
- [x] Regression tests cover null, zero, boundary-equal, below, and above
      `minLoan`.

---

## BOR-002 — Catalog refresh silently substitutes market and collateral

Severity: High<br>
Status: Resolved<br>
Confidence: High<br>
Resolution: `b5b0886b6fcd8c2ff0a1730e7cc03913a1653371`

### Behavior

When a successful market refresh no longer contains the selected market, the
Borrow projection falls back to `markets[0]`. The collateral projection does
the same with `collateralTokens[0]`. Existing borrow and collateral amounts
remain unchanged and can be used to construct a ready Review request for the
fallback assets.

The stored intent IDs are not overwritten; the defect is in the rendered
projection and prepared request. If the old market later returns, the
projection may change again.

### Evidence

- `packages/widget/src/features/borrow/model/borrow-form.ts:156` falls back to
  the first market.
- `packages/widget/src/features/borrow/model/borrow-form.ts:167` falls back to
  the first collateral token.
- `packages/widget/src/features/borrow/model/borrow-form.ts:320` retains the
  entered amounts.
- `packages/widget/src/features/borrow/model/borrow-form.ts:409` prepares
  Review from the substituted projection.

The audit reproduced a selected market/token disappearing after refresh. The
resolver selected different assets and still returned `isActionReady=true`
with the old amounts.

### Fix direction

Distinguish initial default selection from invalidated user intent. If a
selected market or collateral disappears, or a selected market becomes
borrow-disabled, reset the whole form to its initial state and show a
translated notice. Reorder-only refreshes and equivalent catalog
reconstructions retain intent.

### Acceptance criteria

- [x] Initial empty intent may resolve to documented defaults.
- [x] A removed or borrow-disabled selected market resets the whole form.
- [x] A removed selected collateral token resets the whole form.
- [x] Amounts cannot carry into a different projected market/token.
- [x] The reset is explained by a translated user-facing notice.
- [x] Regression tests cover market removal, collateral removal, reorder-only
      refresh, and equivalent catalog reconstruction.

---

## BOR-003 — Projected risk uses one selected/default collateral limit

Severity: High<br>
Status: Resolved<br>
Confidence: High<br>
Resolution: `b5b0886b6fcd8c2ff0a1730e7cc03913a1653371`

### Behavior

Projected LTV includes aggregate existing collateral and debt, but validation
prioritizes the selected collateral token's `maxLtv`. For a borrow-only action,
that token can merely be the UI's first default. Existing collateral with a
stricter limit is ignored.

Withdraw validation similarly compares the projected aggregate LTV only with
the token being withdrawn, not the remaining collateral composition.

This does not bypass protocol-level solvency enforcement, but it can show
optimistic health/readiness and send users into a transaction flow likely to
be rejected.

### Evidence

- `packages/widget/src/features/borrow/model/borrow-form.ts:338` computes
  aggregate projected collateral and debt.
- `packages/widget/src/features/borrow/model/borrow-form.ts:350` prioritizes the
  selected/default collateral risk values.
- `packages/widget/src/features/borrow/model/position-action-form.ts:249`
  validates withdraw against the withdrawn token's `maxLtv`.

The audit reproduced:

- existing collateral with max LTV `0.5`, UI default collateral with `0.8`,
  and projected LTV `0.6` being marked ready;
- withdrawing the `0.8` token while leaving a `0.5` token and projected LTV
  `0.6` being marked submittable.

### Fix direction

Use one domain-owned weighted-capacity projection for account/market risk after
the proposed action:

- borrowing capacity is the sum of `collateralUsd * maxLtv`;
- liquidation capacity is the sum of
  `collateralUsd * liquidationThreshold`;
- eligibility compares projected debt with borrowing capacity;
- health factor divides liquidation capacity by projected debt;
- pool markets use complete account-scoped collateral and debt, while isolated
  markets retain their API-authoritative per-market `positionState`.

When the widget lacks complete collateral risk inputs, show projected risk as
unavailable on the form and Review, but do not block the flow. Known
over-capacity projections remain blocked.

### Acceptance criteria

- [x] Borrow readiness uses the complete projected collateral composition.
- [x] New pool-market actions include same-integration account exposure even
      when the selected market has no exact Position.
- [x] Withdraw readiness uses the collateral composition remaining afterward.
- [x] Displayed projected health factor uses the same rule as eligibility.
- [x] Borrow-only actions do not derive risk from an arbitrary UI default.
- [x] Incomplete risk is shown on the form and Review without blocking.
- [x] Tests cover mixed collateral with different LTV and liquidation limits.

---

## ACT-001 — Successful historical Classic Activity details redirect home

Severity: Medium<br>
Status: Resolved<br>
Confidence: High
Resolution: This commit

### Behavior

Opening a successful or processing Activity item in the Classic presentation
starts an Activity Resume Flow Session and navigates to a completion URL. That
completion route is nested under `ClassicFlowExecutionScope`, but a historical
Activity session has no `executionAction`. The execution binding therefore
redirects to `/`.

Dashboard Activity is not affected because it uses `start-only` and renders
historical details outside the execution scope.

### Evidence

- `packages/widget/src/features/activity/state/start-activity-resume.ts:64`
  pushes the historical completion path.
- `packages/widget/src/features/classic-transaction-flow/ui/classic-flow-routes.tsx:60`
  nests Classic Activity completion under execution.
- `packages/widget/src/features/classic-transaction-flow/react/classic-flow-route.tsx:118`
  redirects when execution is absent.

The audit drove the real click and production route. It expected historical
completion content but returned to the Classic start page.

### Fix direction

Render historical Activity completion outside the execution-only scope, while
keeping completion reached from a live Execution Attempt inside that scope.

### Acceptance criteria

- [x] Classic successful Activity opens historical completion details.
- [x] Classic processing Activity opens historical details.
- [x] Dashboard behavior remains unchanged.
- [x] Live execution completion still requires its Execution Attempt.
- [x] A route-level DOM regression test renders the destination, not only the
      pushed pathname.

---

## EARN-001 — Earn Initialization can reapply after owner change

Severity: Medium<br>
Status: Resolved<br>
Confidence: High
Resolution: This commit

### Behavior

Earn Initialization is guarded only by `userSelected`. Automatic successful
initialization does not mark the initialization as consumed. If the Wallet
Scope Owner later changes before any explicit user selection, owner
reconciliation resets intent while leaving `userSelected=false`. The
projection then passes the initialization parameters again.

This contradicts ADR-0009: initialization is a Widget Instance input, not a
per-owner fallback.

### Evidence

- `packages/widget/src/features/earn/state/atoms-state/machine/owner.ts:20`
  resets intent on owner change while preserving `userSelected`.
- `packages/widget/src/features/earn/state/atoms-state/machine/atoms.ts:59`
  sets `userSelected` only for explicit actions.
- `packages/widget/src/features/earn/state/atoms-state/machine/atoms.ts:102`
  continues supplying init params while `userSelected` is false.
- `docs/adr/0009-earn-state-resolves-selection-and-readiness.md` specifies
  one-time initialization.

The audit resolved initialization for owner A, changed to owner B with a usable
balance fallback, and observed the original initialization target selected
again.

### Fix direction

Treat Earn Initialization as a consumable Widget Instance input. Wait for
Wallet Bootstrap to reach its first terminal result, retain the input while
required Earn resources load, and complete the attempt on the first ready,
empty, or failed Earn result. Commit a resolved selection into machine intent;
leave a failure visible without allowing a later retry to resurrect init
params. Do not retain a separate applied Wallet Scope Owner or reopen
initialization for a later manual connection.

`accountId` is a Wallet Bootstrap hint rather than an Earn resolver input.
Wallet Bootstrap has already attempted Ledger account selection before its
first terminal Wallet State reaches Earn.

### Acceptance criteria

- [x] Initialization applies once per Widget Instance.
- [x] Initialization waits for the initial Wallet Bootstrap attempt.
- [x] Connected and disconnected bootstrap results each get one initialization
      resolution; a later manual connection does not reopen it.
- [x] A required Earn resource failure completes the attempt; a later ordinary
      retry does not restore initialization.
- [x] A later owner change resets intent without reapplying initialization.
- [x] Additional-address-only changes do not reset selection.
- [x] User commands do not re-arm initialization; explicit intent takes
      precedence while the attempt resolves.

---

## POS-001 — Stale Exit/Manage commands can mix Wallet Scope Owners

Severity: Medium<br>
Status: Resolved<br>
Confidence: High
Resolution: This commit

### Behavior

Position Exit and Manage commands are keyed by the rendered
`PositionDetailsWorkflowKey`, but they read the current wallet state at command
time. If a stale rendered command for owner A runs after the wallet changes to
owner B:

- the prepared request uses owner B's address and additional addresses;
- immutable Classic Flow intake captures owner A's `WalletScopeKey`.

The route guard later ejects the user, so the mixed action does not enter
execution, but the user sees misleading Review navigation and an invalid Flow
Session is created.

### Evidence

- `packages/widget/src/features/position-details/state/classic-flow-actions.ts:80`
  prepares Exit from current wallet facts.
- `packages/widget/src/features/position-details/state/classic-flow-actions.ts:179`
  stores the key's older Wallet Scope.
- `packages/widget/src/features/position-details/state/classic-flow-actions.ts:441`
  prepares Manage from current wallet facts.
- `packages/widget/src/features/position-details/state/classic-flow-actions.ts:460`
  stores the older Wallet Scope.

### Fix direction

Before preparation or session creation, compare the current Wallet Scope Owner
with the rendered key's owner. Use one captured Wallet Scope consistently for
both request construction and immutable intake.

### Acceptance criteria

- [x] A stale Exit command cannot start or navigate a Flow Session.
- [x] A stale Manage command cannot start or navigate a Flow Session.
- [x] Request owner and captured Wallet Scope Owner always match.
- [x] EVM owner comparison remains case-insensitive.
- [x] Additional-address-only changes remain valid.

---

## POS-002 — Cosmetic price loading blocks staking submission

Severity: Medium<br>
Status: Resolved<br>
Confidence: High
Resolution: This commit

### Behavior

Dashboard Position Details includes token-price acquisition in its broad
`isFetching` flag. Shared Yield Entry maps that flag directly to Submit
`disabled` and `loading`. Prices are used only for formatted fiat display, so
an ancillary request delays an otherwise ready transaction.

Main Earn does not repeat this defect; its price resource is presentation-only.

### Evidence

- `packages/widget/src/features/position-details/state/dashboard-stake-facade.ts:201`
  reads the price resource.
- `packages/widget/src/features/position-details/state/dashboard-stake-facade.ts:221`
  includes initial price state in `isFetching`.
- `packages/widget/src/features/yield-entry/state/yield-entry.ts:220` disables
  Submit on `isFetching`.
- `packages/widget/tests/pages-dashboard/position-details-yield-entry.browser.test.tsx`
  currently fails because Submit remains disabled without a seeded price
  result.

The focused browser test failed deterministically. Seeding only the price
result made it pass, proving the coupling.

### Fix direction

Separate action-critical readiness from presentation loading. Price loading may
show a placeholder for fiat value but must not block preparation or submission.

### Acceptance criteria

- [x] A valid Position Details stake can submit while prices are loading.
- [x] Fiat presentation updates when prices arrive.
- [x] A price failure does not disable Submit.
- [x] The existing browser test passes without manually seeding prices.

---

## BOR-004 — Non-collateral supplies influence fallback risk metrics

Severity: Medium<br>
Status: Open<br>
Confidence: High

### Behavior

`Position.getTotalCollateralUsd()` correctly excludes supply balances where
`isCollateral=false`, but `getCollateralTokenDetails()` includes every supplied
asset. Its max LTV and liquidation values feed fallback health, dashboard risk,
repay review, and position details.

### Evidence

- `packages/widget/src/domain/borrow/position.ts:95` filters
  `isCollateral=true` for total collateral.
- `packages/widget/src/domain/borrow/position.ts:106` does not apply the same
  filter for collateral limits.

The audit reproduced a position whose only supplied asset was not enabled as
collateral. Total collateral was zero, but finite collateral risk limits were
still returned.

### Fix direction

Derive both collateral value and collateral risk details from the same
collateral-eligible supply set.

### Acceptance criteria

- [ ] Non-collateral supplies do not affect max LTV.
- [ ] Non-collateral supplies do not affect liquidation threshold or penalty.
- [ ] Risk and health projections use the same eligible collateral set.
- [ ] Mixed collateral/non-collateral tests cover the fallback path.

---

## BOR-005 — Execution start resets the wrong position-action form

Severity: Medium<br>
Status: Open<br>
Confidence: High

### Behavior

The Borrow outcome binding resets `borrowActionFormAtom` when execution starts.
Actual Repay and Withdraw intent lives in `borrowRepayFormAtom` and
`borrowWithdrawFormAtom`. Those families are not reset by the outcome, so
returning from Steps can reveal the previously staged amount.

This contradicts the Borrow Transaction Flow architecture, which says
execution start resets the staged action form.

### Evidence

- `packages/widget/src/features/borrow/state/transaction-flow-outcomes.ts:17`
  resets the general action form.
- `packages/widget/src/features/borrow/state/position-action-form.ts:42` owns
  Repay intent.
- `packages/widget/src/features/borrow/state/position-action-form.ts:62` owns
  Withdraw intent.
- `packages/widget/src/features/borrow/state/position-action-form.ts:108`
  resets them only when staging from the action list.

### Fix direction

Make the outcome carry or resolve the exact staged form identity and reset the
owning Repay/Withdraw intent when execution begins.

### Acceptance criteria

- [ ] Repay intent resets on `ExecutionStarted`.
- [ ] Withdraw intent resets on `ExecutionStarted`.
- [ ] Outcomes from stale epochs cannot reset a newer form.
- [ ] Back from Steps does not restore the executed amount.

---

## API-001 — Immediate bundled `rerender()` throws

Severity: Medium<br>
Status: Resolved<br>
Confidence: High
Resolution: This commit

### Behavior

`renderSKWidget()` returns its controller immediately after `root.render()`.
React has not necessarily committed `BundledSKWidget` or installed the
imperative ref. Calling the public `rerender()` method immediately dereferences
`appRef.current` and throws:

```text
TypeError: Cannot read properties of null (reading 'rerender')
```

Calling `rerender()` after unmount has the same unguarded shape.

### Evidence

- `packages/widget/src/App.tsx:119` creates the imperative ref.
- `packages/widget/src/App.tsx:123` schedules the initial render.
- `packages/widget/src/App.tsx:128` dereferences the ref without checking
  readiness or unmounted state.

The audit reproduced this with the real React root, not only a mocked ref.

### Fix direction

Define controller lifecycle semantics explicitly. A robust implementation could
retain the latest requested props outside React and have the component consume
them when committed, or provide a deterministic queued/no-op/error contract.
Do not expose a timing-dependent null dereference.

### Acceptance criteria

- [x] Immediate `rerender()` cannot throw due to an uninstalled ref.
- [x] Multiple pre-commit rerenders deterministically apply the latest props.
- [x] Post-unmount `rerender()` has documented deterministic behavior.
- [x] The Widget Instance document claim remains correct throughout.

---

## BAL-001 — Additional-address changes can miss balance invalidation

Severity: Medium<br>
Status: Open<br>
Confidence: High

### Behavior

Additional-address-only changes do not change the Wallet Scope Owner and do not
invalidate an active Transaction Flow. Token-balance resources, however, are
keyed by the full `WalletScopeKey`. Transaction Workflow invalidates balances
using its captured scope.

If additional addresses change during execution, the currently displayed
balance resource has a different full key. Completion invalidates the old
resource and leaves the current one stale until its ordinary refresh policy
runs.

### Evidence

- `packages/widget/src/services/resource-invalidation.ts:10` stores full
  `WalletScopeKey` in `WalletBalancesInvalidationKey`.
- `packages/widget/src/resources/token-balances/token-balances.ts:38` keys the
  resource by full Wallet Scope.
- `packages/widget/src/resources/token-balances/token-balances.ts:49`
  subscribes to the full-scope invalidation key.
- `packages/widget/src/services/workflow/transaction-workflow-operations-service.ts:11`
  emits invalidation from captured workflow scope.

The audit mounted a current balance resource whose additional addresses
differed from the workflow's captured scope. Workflow invalidation completed,
but the current resource was not reacquired.

### Fix direction

Keep full Wallet Scope as the request/cache identity because additional
addresses affect the response. Use Wallet Scope Owner as the semantic
invalidation category so all cached variants for that owner refresh together.

### Acceptance criteria

- [ ] Full-scope balance requests remain separately cached.
- [ ] Workflow submission/completion invalidates every cached scope variant for
      the same owner.
- [ ] Other owners and networks remain untouched.
- [ ] EVM casing uses owner semantics.

---

## ACT-002 — Canceled and stale Activity rows open blank details

Severity: Medium<br>
Status: Resolved<br>
Confidence: High
Resolution: This commit

### Behavior

Activity list rows are openable whenever Yield data exists. Starting Activity
Resume creates a Flow Session before status routing. `CANCELED` and `STALE`
statuses are not handled by either routing or `ActivityDetailsPage`.

Dashboard switches to a selected Activity view that renders nothing until the
user goes Back. Classic retains a hidden/stale session.

### Evidence

- `packages/widget/src/features/activity/model/activity-action-list-item.ts:241`
  allows details based only on Yield availability.
- `packages/widget/src/features/activity/state/start-activity-resume.ts:50`
  creates the session before branching.
- `packages/widget/src/features/activity/state/start-activity-resume.ts:92`
  falls through for unsupported statuses.
- `packages/widget/src/features/classic-transaction-flow/ui/activity-details.page.tsx:43`
  renders null for those statuses.

### Fix direction

Choose an explicit product behavior:

- render terminal details for canceled/stale actions; or
- make them non-openable and do not create a Flow Session.

### Acceptance criteria

- [x] `CANCELED` Activity never produces a blank selected view.
- [x] `STALE` Activity never produces a blank selected view.
- [x] Unsupported statuses do not leave a hidden active Flow Session.
- [x] List affordance and route behavior agree.

---

## PORT-001 — Earn failure can be presented as an empty portfolio

Severity: Low<br>
Status: Open<br>
Confidence: High

### Behavior

The unified Manage projection reports `hasOnlyErrors` only when both Earn and
Borrow fail. It reports `hasPartialError` only when at least one position
exists. Therefore:

- Earn fails;
- Borrow succeeds with an empty list, is disabled, or is unsupported;
- total positions are zero;

is presented as an empty portfolio instead of a loading/error state.

### Evidence

- `packages/widget/src/features/portfolio/ui/dashboard/positions/model.ts:53`
  requires both sources to fail for `hasOnlyErrors`.
- `packages/widget/src/features/portfolio/ui/dashboard/positions/model.ts:55`
  requires positions for `hasPartialError`.
- `packages/widget/src/features/portfolio/ui/dashboard/positions/positions.page.tsx:66`
  renders an error only for `hasOnlyErrors`.
- `packages/widget/src/features/portfolio/ui/dashboard/positions/positions.page.tsx:130`
  renders the empty state.

### Fix direction

Model source availability separately from successful emptiness. If every
source capable of contributing positions is either failed or unavailable, do
not claim authoritatively that the portfolio is empty.

### Acceptance criteria

- [ ] Earn failure plus inactive Borrow renders an error.
- [ ] Earn failure plus empty successful Borrow communicates partial failure.
- [ ] Successful empty Earn and Borrow still render the true empty state.
- [ ] Existing partial-data behavior remains intact.

---

## Design risks and test gaps

These were not confirmed as current user-flow bugs and should not be promoted
without a real reproduction.

### RISK-001 — Cosmos Wagmi metadata hardcodes ETH

Status: Open risk

`packages/widget/src/services/wallet/connectors/cosmos/chains/index.ts:20`
assigns Ethereum Mainnet native currency metadata to every Cosmos chain.

Current Widget transaction signing uses Cosmos-kit, and balance/gas facts come
from API resources, so the audit found no current production consumer that
mislabels or mis-scales balances. Wagmi-native balance consumers or wallet UI
could expose the incorrect metadata later.

Recommended action:

- map native currency from chain/assets metadata;
- add one mapping test for ATOM, OSMO, and a non-six-decimal exception;
- confirm whether RainbowKit renders this field for Cosmos connectors.

### RISK-002 — Borrow Dashboard form identity includes additional addresses

Status: Open risk

The Dashboard Borrow form family uses full `WalletScopeKey`, including
additional addresses, while Borrow positions and Flow validity correctly use
Wallet Scope Owner identity. An additional-address-only update can therefore
select a fresh empty form even though ownership has not changed.

Recommended action:

- add a regression test covering additional-address-only wallet updates;
- decide whether the form truly depends on additional addresses;
- use owner identity if the form's intent does not.

## Audit verification

The repository baseline produced:

- `mise exec -- pnpm --filter @stakekit/widget lint` — passed;
- `mise exec -- pnpm check-hygiene` — passed;
- configured unit suite — 126 files, 689 tests passed;
- configured DOM suite — 23 files, 83 tests passed;
- configured browser suite — 71 of 72 tests passed.

The one deterministic browser failure is tracked as `POS-002`.

## Resolution log

Record completed work here:

| ID | Resolution | Regression test | Commit / PR |
| --- | --- | --- | --- |
| | | | |
