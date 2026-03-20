import type { TokenDto } from "@stakekit/api-hooks";
import { tokenString } from "../../../domain";
import type {
  YieldBalanceType,
  YieldPendingActionType,
  YieldTokenDto,
} from "../../../providers/yield-api-client-provider/types";
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
