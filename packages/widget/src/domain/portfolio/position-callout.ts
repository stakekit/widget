import { Option, Record } from "effect";

import { isOptionalPendingAction } from "../action/pending-action";
import type { YieldPendingActionType } from "../earn/action-models";
import type { EarnBalance } from "../earn/balance";
import { isUnfinishedInstantExit } from "../earn/confidential-balance";

/**
 * What a position needs of the user, named when it is known: a finished
 * unstake or withdrawal to collect, a locked balance to unlock, or a locked
 * balance with nothing to unlock yet. Any other required pending action is
 * `other`.
 */
type RequiredPositionAction = "withdraw" | "unlock" | "locked" | "other";

/** What a position asks of the user. */
export type PositionAttention = {
  /** A locked balance, or a pending action the position needs. */
  readonly requiredAction: RequiredPositionAction | null;
  /** Work already under way: a cancel request or an Instant Exit to finish. */
  readonly hasPendingRequest: boolean;
  readonly hasPendingClaimRewards: boolean;
};

type PendingActionOfBalance = {
  readonly type: YieldPendingActionType;
  readonly balance: Pick<EarnBalance, "isEncrypted" | "type">;
};

/**
 * How much a pending action asks of the user: `required`, such as a
 * withdrawal that is ready or an unlock; `claim`, rewards to claim; or
 * nothing, for an optional action or an Instant Exit already under way.
 */
export type PendingActionUrgency = "required" | "claim";

export const getPendingActionUrgency = ({
  balance,
  type,
}: PendingActionOfBalance): PendingActionUrgency | null => {
  if (type === "CLAIM_REWARDS") return "claim";
  if (isOptionalPendingAction(type) || isUnfinishedInstantExit(balance, type)) {
    return null;
  }
  return "required";
};

/**
 * A pending action that pays the user out: rewards to claim, or a finished
 * unstake or withdrawal to collect. Its amount is a gain, so it reads in the
 * success tone.
 */
export const isPayoutPendingAction = (type: YieldPendingActionType) =>
  type === "CLAIM_REWARDS" ||
  type === "CLAIM_UNSTAKED" ||
  type === "WITHDRAW" ||
  type === "WITHDRAW_ALL";

/**
 * Reads attention from the types of a position's balances with an amount
 * and the pending actions those balances offer, each with its balance.
 */
export const getPositionAttention = ({
  balanceTypes,
  pendingActions,
}: {
  readonly balanceTypes: ReadonlyArray<EarnBalance["type"]>;
  readonly pendingActions: ReadonlyArray<PendingActionOfBalance>;
}): PositionAttention => {
  // An Instant Exit already began; finalizing it is in progress.
  const hasUnfinishedInstantExit = pendingActions.some(({ balance, type }) =>
    isUnfinishedInstantExit(balance, type)
  );
  const requiredTypes = pendingActions
    .filter((action) => getPendingActionUrgency(action) === "required")
    .map(({ type }) => type);
  const requiredAction = getRequiredPositionAction({
    hasLockedBalance: balanceTypes.includes("locked"),
    requiredTypes,
  });

  return {
    requiredAction,
    hasPendingRequest:
      requiredAction === null &&
      (pendingActions.some(({ type }) => type === "CANCEL_PENDING") ||
        hasUnfinishedInstantExit),
    hasPendingClaimRewards: pendingActions.some(
      ({ type }) => type === "CLAIM_REWARDS"
    ),
  };
};

/** The most pressing action a position needs, named when it is known. */
const getRequiredPositionAction = ({
  hasLockedBalance,
  requiredTypes,
}: {
  readonly hasLockedBalance: boolean;
  readonly requiredTypes: ReadonlyArray<YieldPendingActionType>;
}): RequiredPositionAction | null => {
  if (requiredTypes.some(isPayoutPendingAction)) return "withdraw";
  if (requiredTypes.includes("UNLOCK_LOCKED")) return "unlock";
  if (hasLockedBalance) return "locked";
  if (requiredTypes.length > 0) return "other";
  return null;
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

type PositionCalloutInput = {
  readonly attention: PositionAttention;
  readonly inactiveValidator: InactiveValidatorStatus | null;
};

/**
 * Every status a position can call out, the most pressing first, with when it
 * applies. A required action is named when it is known; only an unknown one
 * calls out `actionRequired`.
 */
const positionCallouts = {
  readyToWithdraw: ({ attention }) => attention.requiredAction === "withdraw",
  readyToUnlock: ({ attention }) => attention.requiredAction === "unlock",
  lockedBalance: ({ attention }) => attention.requiredAction === "locked",
  actionRequired: ({ attention }) => attention.requiredAction === "other",
  validatorsJailed: ({ inactiveValidator }) => inactiveValidator === "jailed",
  validatorsInactive: ({ inactiveValidator }) => inactiveValidator === "other",
  rewardsToClaim: ({ attention }) => attention.hasPendingClaimRewards,
  inProgress: ({ attention }) => attention.hasPendingRequest,
} as const satisfies Record<string, (input: PositionCalloutInput) => boolean>;

/** The one status a position calls out, the most pressing first. */
export type PositionCallout = keyof typeof positionCallouts;

export const getPositionCallout = (
  input: PositionCalloutInput
): PositionCallout | null =>
  Option.match(
    Record.findFirst(positionCallouts, (applies) => applies(input)),
    { onNone: () => null, onSome: ([callout]) => callout }
  );
