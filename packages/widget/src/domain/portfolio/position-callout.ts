import type { TFunction } from "i18next";
import {
  isOptionalPendingAction,
  type YieldPendingActionType,
} from "../action/pending-action";
import { isUnfinishedInstantExit } from "../earn/confidential";
import type { EarnBalance } from "../earn/models";

/** What a position asks of the user. */
export type PositionAttention = {
  /** A locked balance, or a pending action the position needs. */
  readonly actionRequired: boolean;
  /** Work already under way: a cancel request or an Instant Exit to finish. */
  readonly hasPendingRequest: boolean;
  readonly hasPendingClaimRewards: boolean;
};

/**
 * Reads attention from the types of a position's balances with an amount
 * and the pending actions those balances offer, each with its balance.
 */
export const getPositionAttention = ({
  balanceTypes,
  pendingActions,
}: {
  readonly balanceTypes: ReadonlyArray<EarnBalance["type"]>;
  readonly pendingActions: ReadonlyArray<{
    readonly type: YieldPendingActionType;
    readonly balance: Pick<EarnBalance, "isEncrypted" | "type">;
  }>;
}): PositionAttention => {
  // An Instant Exit already began; finalizing it is in progress.
  const hasUnfinishedInstantExit = pendingActions.some(({ balance, type }) =>
    isUnfinishedInstantExit(balance, type)
  );
  // Claims have their own callout; optional actions require nothing.
  const hasRequiredPendingAction = pendingActions.some(
    ({ balance, type }) =>
      type !== "CLAIM_REWARDS" &&
      !isOptionalPendingAction(type) &&
      !isUnfinishedInstantExit(balance, type)
  );
  const actionRequired =
    balanceTypes.includes("locked") || hasRequiredPendingAction;

  return {
    actionRequired,
    hasPendingRequest:
      !actionRequired &&
      (pendingActions.some(({ type }) => type === "CANCEL_PENDING") ||
        hasUnfinishedInstantExit),
    hasPendingClaimRewards: pendingActions.some(
      ({ type }) => type === "CLAIM_REWARDS"
    ),
  };
};

/**
 * How a position presents its first non-active validator: jailed validators
 * get their own callout, every other provider status shares the inactive one.
 */
export type InactiveValidatorStatus = "jailed" | "other";

export const toInactiveValidatorStatus = (
  providers: ReadonlyArray<{
    readonly status?: string | null | undefined;
  }> | null
): InactiveValidatorStatus | null => {
  const status = providers?.find(
    (provider) => provider.status !== "active"
  )?.status;
  if (!status) return null;
  return status === "jailed" ? "jailed" : "other";
};

/**
 * The one status a position calls out, the most pressing first, wherever it
 * shows: its row in the positions list and its page's header read the same.
 */
export type PositionCallout =
  | "actionRequired"
  | "validatorsJailed"
  | "validatorsInactive"
  | "claimRewards"
  | "inProgress";

export const getPositionCallout = ({
  attention,
  inactiveValidator,
}: {
  readonly attention: PositionAttention;
  readonly inactiveValidator: InactiveValidatorStatus | null;
}): PositionCallout | null => {
  if (attention.actionRequired) return "actionRequired";
  if (inactiveValidator === "jailed") return "validatorsJailed";
  if (inactiveValidator) return "validatorsInactive";
  if (attention.hasPendingClaimRewards) return "claimRewards";
  if (attention.hasPendingRequest) return "inProgress";
  return null;
};

export const formatPositionCallout = (
  callout: PositionCallout,
  t: TFunction
): string => {
  switch (callout) {
    case "actionRequired":
      return t("positions.action_required");
    case "validatorsJailed":
      return t("details.validators_jailed");
    case "validatorsInactive":
      return t("details.validators_inactive");
    case "claimRewards":
      return t("positions.claim_rewards");
    case "inProgress":
      return t("positions.in_progress");
  }
};
