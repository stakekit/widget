import type {
  BalanceTypes,
  TokenDto,
  YieldBalanceDto,
  YieldBalancesWithIntegrationIdDto,
} from "@stakekit/api-hooks";
import BigNumber from "bignumber.js";
import { equalTokens } from "..";

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

export const getPositionTotalAmount = ({
  token,
  balances,
}: {
  token: TokenDto & { pricePerShare: YieldBalanceDto["pricePerShare"] };
  balances: YieldBalanceDto[];
}) =>
  balances.reduce((acc, b) => {
    if (b.token.isPoints) return acc;

    if (equalTokens(b.token, token)) {
      return BigNumber(b.amount).plus(acc);
    }

    return BigNumber(b.amount)
      .times(b.pricePerShare)
      .dividedBy(token.pricePerShare)
      .plus(acc);
  }, new BigNumber(0));
