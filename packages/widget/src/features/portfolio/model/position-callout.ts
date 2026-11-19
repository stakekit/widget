import type { TFunction } from "i18next";

import type { PositionCallout } from "../../../domain/portfolio/position-callout";

/**
 * How each status a position calls out reads, wherever it shows: its row in
 * the positions list and its page's header read the same.
 */
const positionCalloutLabels = {
  readyToWithdraw: "positions.ready_to_withdraw",
  readyToUnlock: "positions.ready_to_unlock",
  lockedBalance: "positions.locked_balance",
  actionRequired: "positions.action_required",
  validatorsJailed: "details.validators_jailed",
  validatorsInactive: "details.validators_inactive",
  rewardsToClaim: "positions.rewards_to_claim",
  inProgress: "positions.in_progress",
} as const satisfies Record<PositionCallout, string>;

export const formatPositionCallout = (
  callout: PositionCallout,
  t: TFunction
): string => t(positionCalloutLabels[callout]);
