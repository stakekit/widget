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
| Borrow Market Position | `stageBorrowPositionActionAtom` | Fixed: one attempt-keyed authoritative state transition |
| Earn Selection | `setEarnSelectionValidatorSearchAtom`, `selectEarnSelectionTokenAtom`, `selectEarnSelectionYieldAtom`, `selectEarnSelectionCategoryAtom`, `removeEarnSelectionValidatorAtom`, `selectEarnSelectionProviderAtom`, `setEarnSelectionAmountAtom`, `setEarnSelectionMaxAmountAtom`, `selectEarnSelectionTronResourceAtom` | Compliant local transition |
| Earn Selection | `selectEarnSelectionValidatorAtom` | Fixed: one authoritative selection transition carrying the normalized validator snapshot |
| Earn facade | `setEarnTokenSearchAtom`, `selectEarnTokenAtom`, `setEarnYieldSearchAtom`, `selectEarnYieldAtom`, `selectEarnCategoryAtom`, `earnValidatorModalEventAtom`, `selectEarnValidatorAtom`, `removeEarnValidatorAtom`, `setEarnAmountAtom`, `selectEarnProviderAtom`, `selectEarnTronResourceAtom`, `setEarnMaxAmountAtom` | Compliant local/tail transition; selection commands use permitted telemetry accompaniment |
| Earn resources | `loadMoreEarnTokenOptionsAtom`, `loadMoreEarnValidatorsPageAtom`, `retryEarnMachineAtom` and facade aliases | Authoritative Resource pagination and retry commands |
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
| Wallet | `logoutAtom` | Fixed: one forwarding call to the wallet-owned Logout operation |
| Widget shell | `disconnectWidgetAtom` | Compliant cross-feature tail delegation to Logout |
| Preferences | `acknowledgeTosAtom` | Fixed: one forwarding call to coherent persistence-owned acknowledgement state |

## Resolved follow-up debt

The five originally deferred findings are resolved. Earn intent now retains
explicit normalized validator snapshots and the remembered-resource cache is
deleted. Market Position has one attempt-keyed state family. Logout is one
serialized Wallet Service operation with owned-storage cleanup and modal
finalization. ToS acknowledgement is coherent persistence-owned state. The app
route now supplies one normalized observation Stream to a scoped deep-link
coordinator; claim history, stale-owner checks, Flow start, navigation, and
retry eligibility are private to that module.

The remaining Transaction Workflow and Wagmi static dependencies are also
bound once by private construction factories. Production contains no runtime
`Effect.provideService` calls, and feature code has no direct registry,
subscription, or mount access.
