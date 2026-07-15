import { tokenString } from "../../../../../domain";
import type { AppToken } from "../../../../../domain/schema/legacy-models";
import type { YieldPendingActionType } from "../../../../../domain/types/pending-action";
import type { YieldBalanceType } from "../../../../../domain/types/positions";

import type { BalanceTokenActionType } from "../../../state";

export const getBalanceTokenActionType = ({
  actionType,
  balanceType,
  token,
}: {
  balanceType: YieldBalanceType;
  token: AppToken;
  actionType: YieldPendingActionType;
}): BalanceTokenActionType =>
  `${balanceType}-${tokenString(token)}-${actionType}`;
