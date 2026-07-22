# Core application logic review report

## Scope and method

The current branch was reviewed as a complete application, with equivalent
flows on `main` used as the behavioral regression baseline. Diffs were used only
to locate moved or replaced code. OpenSpec artifacts, commit history, and
existing test assertions were not treated as specifications.

The review covered application/runtime lifecycle, wallet initialization,
classic and dashboard routing, Earn and stake, portfolio and position details,
activity retry, Borrow, shared transaction execution, atom identity, and
resource invalidation.

## Executive summary

The initial review found six high-risk correctness issues and eight medium-risk
flow issues. The dominant failure patterns were:

1. unrelated configuration identity owns lifecycle-sensitive runtime state;
2. route unmount no longer owns the lifetime of side-effecting workflows;
3. long-lived atoms and refs are not consistently scoped to wallet, route, or
   position identity;
4. mutation completion refreshes parallel resource graphs instead of every
   resource actually used by the affected screens.

The high-risk findings were subsequently repaired and independently reviewed.
The round-two results below supersede the original implementation status while
preserving the initial findings as the audit trail.

## Round-two verification (2026-07-17)

### Outcome

Five of the six original high-risk findings are fixed for their reported
failure modes. H3's failure-isolation behavior works at the atom seam, but H3
is **not fixed** because automatic reconnect no longer completes after the
controller becomes ready. The second flow-based
review found four additional high-risk lifecycle or ownership defects; those
were fixed with regression tests before the scope was closed. No medium-risk
finding was fixed in this review round.

| Finding | Verdict | Verification evidence |
| --- | --- | --- |
| H1 runtime rebuild on callback rerender | Fixed | Callback-only host rerenders preserve runtime generation and active workflow identity; signing and submission remain exactly once. |
| H2 classic workflow survives route exit | Fixed | The route guard explicitly mounts the TTL-zero workflow atom. Unmount closes the atom scope and eventually interrupts the processor; no separate route-active flag or per-operation ownership checks remain. |
| H3 wallet initialization loses topology | Not fixed | The built Wagmi configuration is exposed and transient enabled-network failures recover, but the isolated Wagmi provider browser test consistently reaches `ready: true` while remaining `connected: false`. Automatic reconnect no longer completes within 10 seconds. Read-only diagnosis confirmed the scoped fiber remains alive until atom disposal; the likely failure class is overlapping reconnect attempts interacting with Wagmi's global reconnect guard, not immediate fiber cancellation. |
| H4 position state crosses wallets | Fixed | Position data, staged action state, validator selection, and position action forms are cleared or remounted when the normalized network/address owner changes. Resource keys continue using the complete, stable wallet scope. |
| H5 force-max resolves to `-1` | Fixed | Force-max forms resolve to the available balance and remain unavailable while that balance is unknown. |
| H6 completion leaves visible resources stale | Fixed | Completion invalidates wallet-scoped Earn balances/positions, Activity, and Borrow resources. Submission invalidation runs immediately after successful broadcast and before confirmation begins. |

### Architecture alignment follow-up

- Removed the transaction workflow service's `routeActive` flag. Classic guards
  mount the workflow atom directly; its TTL-zero scope owns eventual processor
  interruption.
- Removed `WalletIdentityKey`. Ownership comparisons now use
  `sameWalletScopeOwner` over normalized network/address, while cache and
  invalidation keys retain the complete `WalletScopeKey`.
- Aligned Borrow execution with classic execution. Review stores one execution
  input, a selector derives `BorrowTransactionWorkflowKey`, and a lifecycle
  guard owns Steps and Complete. Executable router state, the action-form
  execution variant, and history tombstones were removed.

### Additional high-risk defects found and fixed

1. **Case-sensitive wallet identities were compared as EVM addresses.** The
   workflow guard and signing validation lowercased every network address, so
   distinct Solana accounts differing by case could be treated as the same
   signer. Identity comparison is now network-aware; EVM addresses remain
   case-insensitive and non-EVM addresses retain their native casing.
2. **A successful broadcast could miss completion invalidation after route
   exit.** Successful submission now records its semantic invalidations before
   confirmation begins. Route exit is handled by scope interruption rather than
   a separate route-active branch.
3. **Borrow execution could restart through browser history.** Returning Back
   from active Borrow steps and then navigating Forward restored executable
   history state and recreated the workflow. Execution is now resolved only
   from the guarded workflow input/key. Leaving the guard clears that input, so
   Forward redirects instead of reconstructing execution.
4. **Borrow position refresh could unmount an active nested execution route.**
   Semantic invalidation temporarily made the routed parent render only its
   loading/empty pane, removing Steps or Complete. Nested route ownership is
   now independent of position loading and empty states, while the position
   pane refreshes separately.

### Remaining findings (report only)

Per review scope, the following medium-risk findings remain unfixed:

| ID | Finding | Current round-two status |
| --- | --- | --- |
| M1 | Earn intent survives implicit wallet/token/yield fallback | Still present. |
| M2 | Borrow review state is not scoped to wallet and route market | Confirmed reachable; backend action creation can occur before signing rejects the stale wallet. |
| M3 | Dashboard Activity details retain the previous wallet selection | UI can remain stale; the wallet-scoped execution guard prevents cross-wallet signing. |
| M4 | Position workflow inputs survive route/position changes | Still present. |
| M5 | Successful preview retry requires a second Confirm | Still present. |
| M6 | Dashboard Activity completion route is unregistered | Still present. |
| M7 | Dashboard validator-selection route mounts the wrong owner | Confirmed reachable. |
| M8 | Classic-to-dashboard variant switch can leave an unmatched route | Still present. |
| M9 | Duplicate queued Retry commands can repeat a wallet prompt | Confirmed. Two retries from one failure generation can make the second queued command valid again after the first retry returns to the same phase. Submission and advance commands have the analogous risk. |
| M10 | Permanent enabled-network errors retry every five seconds | The retry is scoped and stops on widget disposal, but errors such as invalid credentials are not classified as terminal and have no jitter. |
| M11 | Withdraw token selection can become stale after same-wallet position refresh | A removed token or reduced balance can remain captured by the local form and be submitted with old arguments. |
| M12 | Borrow form fallback can retarget preserved amounts | If selected market/collateral IDs disappear, fallback selection can change while the entered amount survives. |
| M13 | Dashboard stake-position completion outlet can disappear after an empty refresh | If successful completion removes the final position and the integration is not enterable, the parent can remove the active nested Complete outlet. |

One lower-confidence race remains for future testing: because wallet
initialization is intentionally non-blocking, a delayed reconnect or initial
switch may overlap a manual connection initiated immediately after the
controller becomes available. No failure was reproduced in this review.

### Open high-risk regression

**H3-R1. Automatic wallet reconnect no longer completes after controller
readiness.** The browser contract reaches the authoritative built Wagmi config,
but `useAccount()` remains disconnected. This reproduced both in the complete
Chromium run and in an isolated two-file rerun. A mounted-atom probe confirmed
the `forkScoped` child starts, remains live after the parent publishes Success,
and stops only on registry disposal. The likely failure class is overlapping
background reconnects: Wagmi can return an empty result while a module-global
reconnect guard is active, and this initialization path does not retry that
result. The exact browser ordering still needs instrumentation. Per the
instruction to stop fixing, no production change was made after this regression
was confirmed.

### Validation

- Widget lint, Biome, and TypeScript: passed.
- Unit: 86 files, 323 tests passed.
- DOM: 20 files, 48 tests passed.
- Hygiene: dependency, cycle, orphan, boundary, unresolved-import, unused
  export, and test-only export checks passed.
- Focused wallet-bootstrap atom verification: passed, including injected scope
  cleanup and rejection behavior. Browser integration does not pass automatic
  reconnect and therefore overrides the atom-only H3 acceptance verdict.
- Focused classic workflow, semantic invalidation, wallet ownership, Borrow
  execution history, and Borrow routed-parent regressions: passed.
- Focused Chromium after the architecture alignment: classic workflow 8/8,
  Borrow execution 6/6, Borrow position flow 2/2, and dashboard rendering 8/8
  passed.
- Full Chromium run: 12 files / 55 tests passed; 5 files / 9 tests failed. The
  known Wagmi reconnect regression reproduced. Dashboard rendering passed when
  isolated; the remaining failures were full-suite gas, staking, and deep-link
  timeouts outside the changed seams.

## High-risk findings

### H1. Callback-only host rerenders rebuild the runtime and restart active workflows

**Confidence:** High. **Baseline:** Branch regression.

A normal host rerender with a newly created `tracking.trackEvent` or
`tracking.trackPageView` function changes `widgetBootstrapConfigAtom`. The
entire `Layer.fresh` application runtime is built from that value, so every
mounted `appRuntime.atom` is restarted, including active transaction machines.
The old machine loses its accumulated submissions and the replacement starts
from the original workflow key in `Signing` or `Confirming`. This can request a
second signature or rebroadcast a transaction already sent by the disposed
machine.

References:

- `packages/widget/src/app/config/widget-config.ts:19-22,41-48`
- `packages/widget/src/app/runtime/app-runtime.ts:21-58`
- `packages/widget/src/features/transaction-flow/state/transaction-workflow-atoms.ts:32-62`
- `packages/widget/src/services/workflow/transaction-workflow-service.ts:37-67`
- `packages/widget/src/services/workflow/transaction-workflow-model.ts:332-355`

Regression test: start a deferred workflow, update only the tracking callback
identity through `widgetConfigAtom`, and assert machine identity, state, and
sign/submit call counts remain unchanged.

### H2. Leaving the classic steps route does not stop transaction execution

**Confidence:** High. **Baseline:** Branch regression.

Cancel only navigates away. The workflow state, completion listener, and machine
atoms retain a five-minute idle TTL, so Effect AtomRegistry delays finalization
and the `forkScoped` processor remains active. A wallet request resolved after
the route is gone can still be submitted, confirmed, and followed by later
transactions and wallet prompts. `main` used a component-owned XState actor;
unmount stopped the actor and explicitly cleared confirmation timeouts.

References:

- `packages/widget/src/features/transaction-flow/ui/steps/hooks/use-steps.hook.ts:53-58`
- `packages/widget/src/features/transaction-flow/state/transaction-workflow-atoms.ts:32-105`
- `packages/widget/src/shared/config/widget-defaults.ts:8-10`
- `packages/widget/src/services/workflow/transaction-workflow-service.ts:37-67`
- `packages/widget/src/services/workflow/transaction-workflow-runtime/processor.ts:100-170`

Regression test: defer signing or confirmation, unmount the steps route, and
assert that the TTL-zero workflow scope is eventually interrupted and cannot be
restarted through Forward navigation.

### H3. Recoverable wallet initialization failures discard the usable wallet topology

**Confidence:** High. **Baseline:** Branch regression.

The branch constructs the Wagmi configuration and then runs reconnect, mobile
fallback connect, and initial chain switching as part of the same failing atom.
If any best-effort operation rejects, `walletControllerAtom` fails and
`WagmiConfigProvider` replaces the already-built configuration with the empty
fallback configuration. The widget then has no usable connectors or recovery
path until remount or a topology-changing config update. `main` retained the
configuration when these initialization attempts failed.

References:

- `packages/widget/src/features/wallet/wagmi/initialization.ts:123-171`
- `packages/widget/src/features/wallet/wagmi/controller.ts:42-76`
- `packages/widget/src/features/wallet/runtime/root-atom.ts:117-131`
- `packages/widget/src/features/wallet/react/provider.tsx:6-14`
- `packages/widget/src/services/wallet/default-wagmi-config.ts:17-25`

Regression test: reject `switchChain` after configuration construction and
assert the configured connector list is still exposed and manual connect works.

### H4. Dashboard position state can cross wallet identities

**Confidence:** High. **Baseline:** Invariant defect also present on `main`.

Dashboard position details retain the last non-null position balances in refs.
When wallet A changes to wallet B and B has no matching position, the new null
result is ignored and A's position remains rendered indefinitely. Exit and
pending-action builders then combine A's retained balances and pending actions
with B's current address. The request can pass signing validation because both
the newly created action and current wallet use B, even though its values came
from A.

References:

- `packages/widget/src/features/position-details/ui/classic/state/index.tsx:59-120`
- `packages/widget/src/features/position-details/ui/classic/hooks/use-stake-exit-request-dto.ts:20-102`
- `packages/widget/src/features/position-details/ui/classic/hooks/use-pending-actions.ts:146-185`
- `packages/widget/src/app/routes/dashboard-routes.tsx:125-183`

Regression test: render A's position, switch to B with an empty positions
response, and require the position/action panel to clear before any request can
be created.

### H5. Force-max Earn integrations initialize the amount to `-1`

**Confidence:** High. **Baseline:** Branch regression.

The force-max contract is represented by `minimum === -1 && maximum === -1`.
The current form resolver uses the raw minimum as its default amount, producing
`-1`, while validation independently maps the minimum and maximum to the wallet
balance. The flow is invalid until the user explicitly presses Max, and can be
blocked where that action is unavailable. `main` initialized force-max forms to
the available balance.

References:

- `packages/widget/src/domain/types/stake.ts:69-105`
- `packages/widget/src/features/earn/react/use-max-min-yield-amount.ts:28-64`
- `packages/widget/src/features/earn/state/atoms-state/resolver/form.ts:46-60`
- `packages/widget/src/features/earn/ui/classic/earn-page/state/earn-page-model.tsx:534-570`

Regression test: resolve a force-max yield with available balance `10` and
assert `view.form.stakeAmount === "10"`, not `"-1"`.

### H6. Successful mutations leave the resources used by affected screens stale

**Confidence:** High. **Baseline:** Mixed branch regressions and new invariant
defects.

The completion handlers refresh parallel or list resources, but omit several
feature-owned resources used by the visible screens:

- Earn completion refreshes portfolio balance scans, but Earn derives its form
  from separate private token-balance and catalog-position atoms with five-minute
  SWR. A quick return can show pre-stake balance and minimum values.
- Activity pages and filter counts are never refreshed after completion.
  Remounting their `Atom.pull` within the five-minute idle TTL reuses the old
  accumulated pages without another API call.
- Borrow completion refreshes `borrowPositionsAtom`, but the routed position
  page reads the distinct `borrowPositionAtom`. The parent details route remains
  mounted through review, steps, and completion, so returning from a successful
  repay/withdraw/toggle continues to show the old position and pending actions.

References:

- `packages/widget/src/features/transaction-flow/state/transaction-workflow-atoms.ts:15-30,80-96`
- `packages/widget/src/features/earn/state/atoms-state/catalog/atoms.ts:55-59,172-190,367-386,520-534`
- `packages/widget/src/features/activity/react/use-activity-actions.ts:45-107,282-300`
- `packages/widget/src/features/borrow/atoms/refresh.ts:49-83`
- `packages/widget/src/features/borrow/atoms/resources.ts:126-168`
- `packages/widget/src/features/borrow/ui/use-borrow-positions.ts:38-54`
- `packages/widget/src/features/borrow/ui/position-details.tsx:1178-1299`

Regression tests should drive each mutation to completion and require the exact
resources consumed by Earn, Activity, and Borrow position details to issue a
new request and display the new state.

## Medium-risk findings

### M1. Earn form intent survives implicit wallet/token/yield scope changes

**Confidence:** High. **Baseline:** Branch regression.

Network change or disconnect/reconnect can make token and yield resolution fall
back to a new scope while retaining the previous amount, provider ID, Tron
resource, and max-amount flag. Explicit token/yield actions reset these fields,
but resolver-driven selection changes do not. A request for the new yield can
therefore include a provider belonging to the previous yield.

References:

- `packages/widget/src/features/earn/state/atoms-state/machine/atoms.ts:16-60`
- `packages/widget/src/features/earn/state/atoms-state/machine/reducer.ts:6-49`
- `packages/widget/src/features/earn/state/atoms-state/resolver/token.ts:16-60`
- `packages/widget/src/features/earn/state/atoms-state/resolver/yield.ts:53-105`
- `packages/widget/src/features/earn/state/atoms-state/resolver/form.ts:18-27,55-59`
- `packages/widget/src/features/earn/ui/classic/earn-page/state/use-stake-enter-request-dto.ts:96-110`

### M2. Borrow review/execution state is not scoped to the current wallet or route

**Confidence:** High. **Baseline:** New invariant defect.

`borrowActionFormAtom` is a single registry-wide state value. The Borrow route
guard verifies only that some supported wallet is connected, and review prefers
history state or the global staged state without comparing its address/network
or market with the current wallet and route. Switching from wallet A to B on
Review lets Confirm call the Borrow API with A's staged request; wallet mismatch
is detected only later during transaction signing, after the backend action has
already been created. A stale market review can likewise be rendered under a
different position route.

References:

- `packages/widget/src/features/borrow/atoms/action-form.ts:107-140`
- `packages/widget/src/features/borrow/ui/connected-wallet.tsx:10-17`
- `packages/widget/src/features/borrow/ui/review.tsx:52-70,130-143`
- `packages/widget/src/services/workflow/transaction-workflow-runtime/signing.ts:28-73`

### M3. Dashboard activity retry remains bound to the previous wallet

**Confidence:** High. **Baseline:** Invariant defect also present on `main`.

Selecting activity writes a keep-alive selection and unmounts the Activity page
that owns wallet-change cleanup. Account/network changes while details are open
therefore leave the old action retryable through the new `WalletService`.
Signing normally fails late on identity validation rather than clearing the
invalid flow immediately.

References:

- `packages/widget/src/features/activity/state/selection.ts:24-55`
- `packages/widget/src/features/activity/ui/dashboard/activity/index.tsx:20-54`
- `packages/widget/src/features/activity/ui/dashboard/activity/activity.page.tsx:93-108`

### M4. Position workflow inputs leak across route unmounts and positions

**Confidence:** High. **Baseline:** Branch regression.

Unstake amount, max-amount selection, and pending-action input live in one
keep-alive `positionDetailsWorkflowAtom`. A newly mounted hook initializes its
`previousWorkflowKey` to the new current key, so its reset effect sees no
transition and preserves state inherited from the previously unmounted
position. `main` used provider-local reducer state that was discarded on
unmount.

References:

- `packages/widget/src/features/position-details/state/workflow.ts:35-40,75-78`
- `packages/widget/src/features/position-details/ui/classic/state/index.tsx:238-247`

### M5. A successful stake-preview retry requires a second Confirm click

**Confidence:** High. **Baseline:** Branch regression.

When initial preview fails, Confirm calls `refetch()` and returns. A successful
refetch has no continuation that navigates to steps; the user must click Confirm
again. `main` awaited the retry and continued on the same click.

References:

- `packages/widget/src/features/transaction-flow/ui/review/hooks/use-stake-review.hook.ts:162-203`

### M6. Dashboard activity completion navigates to an unregistered route

**Confidence:** High. **Baseline:** Invariant defect also present on `main`.

Successful retry steps navigate relatively to
`/activity/:pendingActionType/complete`, but dashboard routes register only the
corresponding `steps` child. The details shell remains with an empty outlet
instead of showing completion.

References:

- `packages/widget/src/features/transaction-flow/ui/review/hooks/use-action-review.hook.ts:90-124`
- `packages/widget/src/features/transaction-flow/ui/steps/hooks/use-steps.hook.ts:33-51`
- `packages/widget/src/app/routes/dashboard-routes.tsx:188-203`

### M7. The dashboard validator-selection child route mounts the wrong page

**Confidence:** High. **Baseline:** Invariant defect also present on `main`.

The outer position route already renders `DashboardPositionDetailsPage`, but
its validator-selection child renders a second full
`DashboardPositionDetailsPage`. The component that owns and renders the
`SelectValidator` modal is absent, so the registered route cannot present the
selection UI or continue the pending action.

References:

- `packages/widget/src/app/routes/dashboard-routes.tsx:125-151`
- `packages/widget/src/features/position-details/ui/dashboard/index.tsx:54-104`
- `packages/widget/src/features/position-details/ui/classic/hooks/use-pending-actions.ts:120-144`
- `packages/widget/src/features/position-details/ui/dashboard/components/position-details-actions.tsx:225-260`

### M8. Switching classic Positions to dashboard through rerender blanks the widget

**Confidence:** High. **Baseline:** Invariant defect also present on `main`.

The memory router survives supported prop rerenders. If classic is at
`/positions` and `dashboardVariant` becomes true, dashboard routes have neither
a `/positions` route nor a catch-all redirect, so no shell or page matches.

References:

- `packages/widget/src/App.tsx:25-31,41-64,68-97`
- `packages/widget/src/app/routes/dashboard-routes.tsx:95-210`

## Hardening issue not promoted to the main list

Unstake and pending-action review hooks dereference nullable request atoms with
non-null assertions, while their review routes are outside workflow-state
guards. A custom/direct memory-router entry can crash. The public widget creates
its own memory router at `/`, so a fresh-registry direct review entry was not
confirmed through the supported external API. The routes should still guard
ephemeral request state for consistency with steps and completion.

References:

- `packages/widget/src/app/routes/classic-routes.tsx:179-209`
- `packages/widget/src/app/routes/dashboard-routes.tsx:153-180`
- `packages/widget/src/features/transaction-flow/ui/review/hooks/use-unstake-review.hook.ts:33-45`
- `packages/widget/src/features/transaction-flow/ui/review/hooks/use-pending-review.hook.ts:25-48`

## Validation performed

- TypeScript no-emit check passed.
- Focused unit suites passed: 13 files, 48 tests covering transaction workflow
  model/runtime/atoms and Borrow domain/atoms.
- Focused browser suites passed: 3 files, 8 tests covering classic transaction
  execution, Borrow execution, and Borrow position details.
- The focused wallet-atom unit suite passed.

These green suites do not exercise the state-transition sequences above; each
finding includes the missing regression scenario that should be added before or
with its fix.

## Recommended fix order

1. Decouple runtime identity from dynamic tracking callbacks and make workflow
   ownership explicit.
2. Stop side-effecting workflow processors immediately when their route owner
   exits.
3. Preserve usable wallet topology across initialization failures.
4. Introduce wallet/route/position-scoped reset rules for long-lived flow state.
5. Centralize mutation-to-resource invalidation and refresh every resource
   actually consumed by affected screens.
6. Fix the force-max resolver and the isolated routing/retry defects.
