import type { EarnBalance } from "../../../domain/earn/models";
import { getPositionBalanceDataKey } from "../../../domain/portfolio/positions";

/**
 * A deep link with `balanceId` targets only balances under that position key;
 * without it, the first balance offering the pending action wins.
 */
export const findPendingActionDeepLinkTarget = ({
  balanceId,
  balances,
  pendingActionType,
  validator,
}: {
  readonly balanceId: string | null;
  readonly balances: ReadonlyArray<EarnBalance>;
  readonly pendingActionType: string;
  readonly validator: string | null;
}) => {
  for (const balance of balances) {
    if (balanceId && getPositionBalanceDataKey(balance) !== balanceId) continue;
    if (
      validator &&
      balance.validator?.address !== validator &&
      !balance.validators?.some((item) => item.address === validator)
    ) {
      continue;
    }

    const pendingAction = balance.pendingActions.find(
      (item) => item.type === pendingActionType
    );

    if (pendingAction) return { balance, pendingAction };
  }

  return null;
};
