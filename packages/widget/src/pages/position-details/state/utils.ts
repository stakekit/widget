import { tokenString } from "../../../domain";
import type { YieldPendingActionType } from "../../../domain/types/pending-action";
import type { YieldBalanceType } from "../../../domain/types/positions";
import type { TokenDto, YieldTokenDto } from "../../../domain/types/tokens";
import type { BalanceTokenActionType } from "./types";

export const getBalanceTokenActionType = ({
  actionType,
  balanceType,
  token,
}: {
  balanceType: YieldBalanceType;
  token: TokenDto | YieldTokenDto;
  actionType: YieldPendingActionType;
}): BalanceTokenActionType =>
  `${balanceType}-${tokenString(token)}-${actionType}`;
