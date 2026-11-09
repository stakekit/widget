import { Option, Record } from "effect";
import type { TFunction } from "i18next";

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
 * applies and how it reads, wherever it shows: its row in the positions list
 * and its page's header read the same. A required action is named when it is
 * known; only an unknown one reads as Action required.
 */
const positionCallouts = {
  readyToWithdraw: {
    applies: ({ attention }) => attention.requiredAction === "withdraw",
    label: "positions.ready_to_withdraw",
  },
  readyToUnlock: {
    applies: ({ attention }) => attention.requiredAction === "unlock",
    label: "positions.ready_to_unlock",
  },
  lockedBalance: {
    applies: ({ attention }) => attention.requiredAction === "locked",
    label: "positions.locked_balance",
  },
  actionRequired: {
    applies: ({ attention }) => attention.requiredAction === "other",
    label: "positions.action_required",
  },
  validatorsJailed: {
    applies: ({ inactiveValidator }) => inactiveValidator === "jailed",
    label: "details.validators_jailed",
  },
  validatorsInactive: {
    applies: ({ inactiveValidator }) => inactiveValidator === "other",
    label: "details.validators_inactive",
  },
  rewardsToClaim: {
    applies: ({ attention }) => attention.hasPendingClaimRewards,
    label: "positions.rewards_to_claim",
  },
  inProgress: {
    applies: ({ attention }) => attention.hasPendingRequest,
    label: "positions.in_progress",
  },
} as const satisfies Record<
  string,
  {
    readonly applies: (input: PositionCalloutInput) => boolean;
    readonly label: string;
  }
>;

/** The one status a position calls out, the most pressing first. */
export type PositionCallout = keyof typeof positionCallouts;

export const getPositionCallout = (
  input: PositionCalloutInput
): PositionCallout | null =>
  Option.match(
    Record.findFirst(positionCallouts, ({ applies }) => applies(input)),
    { onNone: () => null, onSome: ([callout]) => callout }
  );

export const formatPositionCallout = (
  callout: PositionCallout,
  t: TFunction
): string => t(positionCallouts[callout].label);
