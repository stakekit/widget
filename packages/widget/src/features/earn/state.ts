// Collaboration contract only: the pending-action deep link that the app router
// resolves before entering Earn, and the yield selection the dashboard shell
// reads to drive its category tabs. Earn's own page state stays private.
export { useEarnYieldSelection } from "./react/use-earn-facades";
export {
  PendingActionDeepLinkIntentId,
  pendingActionDeepLinkViewAtom,
  samePendingActionDeepLinkIntent,
} from "./state/pending-action-deep-link";
