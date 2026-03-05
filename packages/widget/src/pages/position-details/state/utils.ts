import type { ActionTypes, TokenDto } from "@stakekit/api-hooks";
import { tokenString } from "../../../domain";
import type {
  YieldBalanceType,
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
  actionType: ActionTypes;
}): BalanceTokenActionType =>
  `${balanceType}-${tokenString(token)}-${actionType}`;
