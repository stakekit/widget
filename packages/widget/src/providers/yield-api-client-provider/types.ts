import type { components } from "../../types/yield-api-schema";

export type YieldBalancesRequestDto =
  components["schemas"]["BalancesRequestDto"];
export type YieldSingleBalancesRequestDto =
  components["schemas"]["YieldBalancesRequestDto"];
export type YieldBalanceType = components["schemas"]["BalanceType"];

export type YieldPendingActionDto = components["schemas"]["PendingActionDto"];
export type YieldTokenDto = components["schemas"]["TokenDto"];

export type YieldValidatorDto = components["schemas"]["ValidatorDto"];

export type YieldBalanceDto = components["schemas"]["BalanceDto"];

export type YieldBalancesByYieldDto = components["schemas"]["YieldBalancesDto"];
export type YieldSingleBalancesResponseDto =
  components["schemas"]["YieldBalancesDto"];

export type YieldBalancesResponseDto =
  components["schemas"]["BalancesResponseDto"];
