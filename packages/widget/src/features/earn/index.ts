import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../app/runtime/app-runtime";
import { projectTransactionWorkflowStarted } from "../../services/events/widget-domain-events";
import { resetEarnEntryIntentForOwnerAtom } from "./state/earn-selection/state/atoms";

export {
  formatCooldownDays,
  formatMinStake,
  formatMinStakeLabel,
  formatOptionalDays,
  formatPricePerShare,
  formatRewardClaiming,
  formatRewardRateLabel,
  formatRewardTokenLabel,
} from "./model/earn-details-formatters";

export const earnEntryIntentEventProjectionAtom = appRuntime
  .atom((context) =>
    projectTransactionWorkflowStarted(
      (event) =>
        Effect.sync(() =>
          context.set(resetEarnEntryIntentForOwnerAtom, event.owner)
        ),
      "Earn Entry Intent projection failed."
    )
  )
  .pipe(Atom.withLabel("earnEntryIntentEventProjectionAtom"));

export { useEarnYieldSelection } from "./react/use-earn-facades";
export { pendingActionDeepLinkViewAtom } from "./state/pending-action-deep-link";
