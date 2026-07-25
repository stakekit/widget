// Collaboration contract only: how other features start a Classic Transaction
// Flow and observe its action history. Session, review, and execution
// machinery stays private to the feature and its route tree.
export {
  type ClassicTransactionFlowIntake,
  isClassicTransactionFlowWalletScopeValid,
  makeClassicTransactionFlowDestination,
} from "./model/classic-transaction-flow";
export {
  actionHistoryRevisionAtom,
  incrementActionHistoryRevision,
  resetActionHistoryRevision,
} from "./state/action-history";
export {
  type ClassicFlowSession,
  classicFlowSessionStore,
  finishClassicTransactionFlowAtom,
  makeStartClassicFlowSession,
} from "./state/flow-session-store";
