import type {
  ActionTypes,
  TokenDto,
  YieldBalanceDto,
} from "@stakekit/api-hooks";
import { tokenString } from "../../domain";
import type { BalanceTokenActionType } from "./types";

export const getBalanceTokenActionType = ({
  actionType,
  balanceType,
  token,
}: {
  balanceType: YieldBalanceDto["type"];
  token: TokenDto;
  actionType: ActionTypes;
}): BalanceTokenActionType =>
  `${balanceType}-${tokenString(token)}-${actionType}`;
