import type { AppToken } from "../../../../../domain/schema/legacy-models";
import type { YieldPendingActionType } from "../../../../../domain/types/pending-action";
import type { YieldBalanceType } from "../../../../../domain/types/positions";
import { tokenString } from "../../../../../domain/types/tokens";

import type { BalanceTokenActionType } from "../../../state/workflow";

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
