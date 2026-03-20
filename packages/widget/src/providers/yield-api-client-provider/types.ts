import type { components } from "../../types/yield-api-schema";

export type YieldDto = components["schemas"]["YieldDto"];
export type YieldBalancesRequestDto =
  components["schemas"]["BalancesRequestDto"];
export type YieldSingleBalancesRequestDto =
  components["schemas"]["YieldBalancesRequestDto"];
export type YieldBalanceType = components["schemas"]["BalanceType"];

export type YieldPendingActionDto = components["schemas"]["PendingActionDto"];
export type YieldTokenDto = components["schemas"]["TokenDto"];
export type YieldRewardDto = components["schemas"]["RewardDto"];
export type YieldRewardRateDto = components["schemas"]["RewardRateDto"];
export type YieldActionArgumentsDto =
  components["schemas"]["ActionArgumentsDto"];
export type YieldCreateActionDto = components["schemas"]["CreateActionDto"];
export type YieldCreateManageActionDto =
  components["schemas"]["CreateManageActionDto"];
export type YieldPendingActionType =
  | YieldPendingActionDto["type"]
  | NonNullable<YieldCreateManageActionDto["action"]>;

export type YieldValidatorDto = components["schemas"]["ValidatorDto"];

export type YieldBalanceDto = components["schemas"]["BalanceDto"];
export type YieldActionDto = components["schemas"]["ActionDto"];
export type YieldTransactionDto = components["schemas"]["TransactionDto"];

export type YieldBalancesByYieldDto = components["schemas"]["YieldBalancesDto"];
export type YieldSingleBalancesResponseDto =
  components["schemas"]["YieldBalancesDto"];

export type YieldBalancesResponseDto =
  components["schemas"]["BalancesResponseDto"];
export type YieldPaginatedResponseDto =
  components["schemas"]["PaginatedResponseDto"];
