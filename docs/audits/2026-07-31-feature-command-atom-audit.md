# Feature Command Atom Audit — 2026-07-31

## Scope

This audit covers every production feature command declared with
`Atom.fnSync`, `appRuntime.fn`, or `walletRuntime.fn`, including commands made
inside feature factories. Writable state reducers and Authoritative Resource
implementations are not command Atoms; resource-facing commands are listed
separately because their cache and pagination machinery is an accepted
exception in ADR-0017.

The review rule is the command budget from ADR-0017: read a snapshot, invoke a
pure decision, then perform one local transition, one scoped-handle operation,
or one cross-feature tail delegation. Non-authoritative telemetry may accompany
that operation. Expected semantic rejection must be typed.

## Inventory

| Area | Commands | Classification |
| --- | --- | --- |
| Classic Transaction Flow | `startClassicTransactionFlowAtom`, `abandonActivityResumeAtomFamily`, Review `confirmAtom`, Execution `workflowDispatchAtom`, `backAtom`, `finishAtom` | Compliant scoped operation or service forwarding |
| Borrow Transaction Flow | `startBorrowTransactionFlowAtom`, Review `confirmAtom`/`backAtom`, Execution `workflowCommandAtom`/`backAtom`/`finishAtom` | Compliant scoped operation or service forwarding |
| Yield Entry | factory `submitAtom` | Fixed: closed pure decision followed by one local invalidation, one service operation, or one Classic Flow tail delegation |
| Borrow Entry | `setBorrowAmountAtom`, `setBorrowCollateralAmountAtom`, `setBorrowCollateralMaxAmountAtom`, `selectBorrowMarketAtom`, `selectBorrowCollateralTokenAtom`, `startBorrowEntryReviewAtom` | Compliant; start now preserves typed `Unavailable`, `Started`, and stale-owner outcomes |
| Borrow Market Position | `startBorrowPositionActionReviewAtom` | Compliant; start now preserves typed `Unavailable`, `Started`, and stale-owner outcomes |
| Borrow Market Position | `stageBorrowPositionActionAtom` | Deferred; see below |
| Earn Selection | `setEarnSelectionValidatorSearchAtom`, `selectEarnSelectionTokenAtom`, `selectEarnSelectionYieldAtom`, `selectEarnSelectionCategoryAtom`, `removeEarnSelectionValidatorAtom`, `selectEarnSelectionProviderAtom`, `setEarnSelectionAmountAtom`, `setEarnSelectionMaxAmountAtom`, `selectEarnSelectionTronResourceAtom` | Compliant local transition |
| Earn Selection | `selectEarnSelectionValidatorAtom` | Deferred; see below |
| Earn facade | `setEarnTokenSearchAtom`, `selectEarnTokenAtom`, `setEarnYieldSearchAtom`, `selectEarnYieldAtom`, `selectEarnCategoryAtom`, `earnValidatorModalEventAtom`, `selectEarnValidatorAtom`, `removeEarnValidatorAtom`, `setEarnAmountAtom`, `selectEarnProviderAtom`, `selectEarnTronResourceAtom`, `setEarnMaxAmountAtom` | Compliant local/tail transition; selection commands use permitted telemetry accompaniment |
| Earn resources | `loadMoreEarnTokenOptionsAtom`, `loadMoreEarnValidatorsPageAtom`, `rememberEarnValidatorsAtom`, `retryEarnMachineAtom` and facade aliases | Authoritative Resource pagination, remembered-page identity, and retry commands |
| Earn KYC | `refreshEarnKycAtom` | Authoritative Resource refresh delegation |
| Position Details Exit | `setPositionDetailsExitAmountAtom`, `setPositionDetailsExitMaxAmountAtom`, `submitPositionDetailsExitAtom` | Fixed: pure decision, one local invalid transition or one Classic Flow tail delegation, and typed outcome |
| Position Details Pending Action | `openPositionPendingActionModalAtom`, `closePositionPendingActionModalAtom`, `togglePositionPendingActionValidatorAtom`, `runPositionPendingActionAtom` | Fixed: pure modal/submit decisions, one local transition or Classic Flow tail delegation, and identity-keyed Started receipt |
| Position Details stake | factory `setAmountAtom`, `setTronResourceAtom`, `setMaxAmountAtom`, `submitAtom`; facade forwarders `setPositionDetailsStakeAmountAtom`, `setPositionDetailsStakeTronResourceAtom`, `setPositionDetailsStakeMaxAmountAtom`, `submitPositionDetailsStakeAtom` | Compliant local transition, permitted telemetry, or one Yield Entry command forwarding |
| Position Details resources | factory `refreshKycAtom`, `refreshPositionDetailsStakeKycAtom`, `loadMorePositionDetailsValidatorsAtom`, `refreshPositionDetailsKycAtom`, `loadMorePositionDetailsExitValidatorsAtom`, `refreshPositionDetailsExitKycAtom` | Authoritative Resource pagination/refresh commands and one-step forwarders |
| Position Details workflow | `dispatchPositionDetailsWorkflowAtom` | Compliant pure reduction into one authoritative state transition |
| Activity | `setActivityPageFilterAtom`, `startActivityResumeAtom` | Compliant; Activity Resume now returns typed `Unavailable`, connect-modal, Started, or rejected outcomes |
| Activity resources | `loadMoreActivityAtom`, `retryActivityPageAtom`, `loadMoreActivityActionsAtom` | Authoritative Resource pagination/retry commands; the page retry deliberately refreshes its two jointly authoritative page resources |
| Yield Summary | `refreshCurrentYieldKycAtom` | Authoritative Resource refresh command |
| Classic Review resources | `refreshKycAtom` | Authoritative Resource refresh delegation |
| Tracking | `trackEventAtom`, `trackPageViewAtom` | Compliant single tracking service operation |
| Wallet | `addLedgerAccountAtom`, `walletModalAdapterAtom` | Compliant single semantic service operation |
| Wallet | `logoutAtom` | Deferred; see below |
| Widget shell | `disconnectWidgetAtom` | Compliant cross-feature tail delegation to Logout |
| Preferences | `setTosAcceptedAtom` | Deferred; see below |

## Explicitly deferred debt

1. `selectEarnSelectionValidatorAtom` writes the validator resource's
   remembered-page cache and then the selection intent. Removing that pairing
   safely requires the authoritative selection state to retain the normalized
   selected validator value, so search/pagination cannot make a selected item
   disappear. Treating the two writes as a generic command helper would only
   hide the ownership problem.
2. `stageBorrowPositionActionAtom` resets the separate repay and withdraw stores
   before staging the selected action. The correct seam is one authoritative,
   attempt-keyed Market Position action store. This is a separate state-model
   migration, not part of passive Flow outcome reconciliation. The unused
   standalone reset command was removed during this audit.
3. `logoutAtom` sequences wallet disconnect, IndexedDB cleanup, and wallet-modal
   cleanup in a state module. It should become one wallet-owned semantic Effect
   service operation, with the Atom only forwarding to it. That changes wallet
   lifecycle/error policy and needs its own characterization slice.
4. `setTosAcceptedAtom` performs a persistence write and refreshes its read Atom.
   It should move behind a persistence capability that publishes coherent state
   or returns an update receipt consumed by the adapter. Dropping the refresh
   now would leave stale UI state.
5. `pending-action-deep-link.ts` uses writable resource/state machinery rather
   than an `Atom.fn*` command, but its remaining coordinator behavior is known
   debt. It is intentionally excluded from this batch because it requires a
   separate lifecycle and stale-result design.

Static service dependency cleanup outside the migrated Flow/Yield Entry slices
is also intentionally separate. Neither exclusion weakens the new mechanical
rules: all feature models and orchestration modules are Atom-independent, and
feature code has no direct registry, subscription, or mount access.
