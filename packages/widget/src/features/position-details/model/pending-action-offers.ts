import BigNumber from "bignumber.js";

import {
  getPendingActionStateKey,
  type PendingActionStateKey,
} from "../../../domain/action/action-command";
import {
  getPendingActionAmountConfig,
  isPendingActionAmountRequired,
} from "../../../domain/action/pending-action";
import type { PendingAction } from "../../../domain/earn/action-models";
import type { EarnBalance } from "../../../domain/earn/balance";
import {
  exactZero,
  truncateToTokenDecimals,
} from "../../../domain/finance/exact";

type PendingActionAmountValidation =
  | "AboveMaximum"
  | "BelowMinimum"
  | "Required"
  | null;

type PendingActionOfferBalance = Pick<
  EarnBalance,
  "amount" | "pendingActions" | "token" | "type"
>;

/**
 * A Pending Action the position offers, once, with everything its row shows
 * and its command needs, all taken from the one balance it comes from.
 */
export type PendingActionOffer<Balance extends PendingActionOfferBalance> =
  Readonly<{
    /** What the position shows once: the action's type and passthrough. */
    id: string;
    /** Where its entered amount lives, as its command reads it. */
    key: PendingActionStateKey;
    /** The first balance offering it, as the API lists them. */
    yieldBalance: Balance;
    pendingAction: PendingAction;
    /** The amount it acts on; null when its arguments take none. */
    amount: BigNumber | null;
    validation: PendingActionAmountValidation;
  }>;

const projectAmount = ({
  balance,
  entered,
  pendingAction,
}: {
  readonly balance: PendingActionOfferBalance;
  readonly entered: BigNumber | undefined;
  readonly pendingAction: PendingAction;
}): Pick<
  PendingActionOffer<PendingActionOfferBalance>,
  "amount" | "validation"
> => {
  if (!isPendingActionAmountRequired(pendingAction)) {
    return { amount: null, validation: null };
  }

  const config = getPendingActionAmountConfig(pendingAction);
  const configuredMaximum = config?.maximum;
  const maximum =
    configuredMaximum == null || configuredMaximum.isEqualTo(-1)
      ? balance.amount
      : BigNumber.min(balance.amount, configuredMaximum);
  const configuredMinimum = config?.minimum;
  const minimum =
    configuredMinimum == null || configuredMinimum.isEqualTo(-1)
      ? exactZero()
      : configuredMinimum;
  const selectedAmount = config?.forceMax
    ? balance.amount
    : (entered ??
      BigNumber.max(minimum, BigNumber.min(maximum, balance.amount)));
  const amount = truncateToTokenDecimals(
    selectedAmount,
    balance.token.decimals
  );
  const validation = (() => {
    if (!amount.isGreaterThan(0)) return "Required" as const;
    if (amount.isLessThan(minimum)) return "BelowMinimum" as const;
    if (amount.isGreaterThan(maximum)) return "AboveMaximum" as const;
    return null;
  })();

  return { amount, validation };
};

/**
 * A position's Pending Actions, each once, in the order the API lists them.
 * An action is one transaction, named by its type and passthrough, and the
 * API can offer the same one on several balances, such as a claim on both
 * the staked balance and the rewards it claims, or a withdrawal on two
 * Campaigns' locked balances. Each takes the first balance offering it.
 */
export const getPendingActionOffers = <
  Balance extends PendingActionOfferBalance,
>({
  balances,
  enteredAmounts,
}: {
  readonly balances: ReadonlyArray<Balance>;
  /** Amounts the user entered, by state key. */
  readonly enteredAmounts: ReadonlyMap<PendingActionStateKey, BigNumber>;
}): ReadonlyArray<PendingActionOffer<Balance>> => {
  const offers = new Map<string, PendingActionOffer<Balance>>();
  for (const balance of balances) {
    for (const pendingAction of balance.pendingActions) {
      const id = `${pendingAction.type}-${pendingAction.passthrough}`;
      if (offers.has(id)) continue;
      const key = getPendingActionStateKey({
        actionType: pendingAction.type,
        balanceType: balance.type,
        passthrough: pendingAction.passthrough,
        token: balance.token,
      });
      offers.set(id, {
        id,
        key,
        pendingAction,
        yieldBalance: balance,
        ...projectAmount({
          balance,
          entered: enteredAmounts.get(key),
          pendingAction,
        }),
      });
    }
  }
  return [...offers.values()];
};
