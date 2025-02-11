import type {
  BalanceTypes,
  YieldBalanceDto,
  YieldBalancesWithIntegrationIdDto,
} from "@stakekit/api-hooks";
import type BigNumber from "bignumber.js";

export type PositionBalancesByType = Map<
  BalanceTypes,
  (YieldBalanceDto & {
    tokenPriceInUsd: BigNumber;
  })[]
>;

export type PositionDetailsLabelType = "hasFrozenV1";

export type PositionsData = Map<
  YieldBalancesWithIntegrationIdDto["integrationId"],
  {
    integrationId: YieldBalancesWithIntegrationIdDto["integrationId"];
    balanceData: Map<
      YieldBalanceDto["groupId"],
      { balances: YieldBalanceDto[] } & (
        | { type: "validators"; validatorsAddresses: string[] }
        | { type: "default" }
      )
    >;
  }
>;
