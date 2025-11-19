import type {
  AmountArgumentOptionsDto,
  TokenBalanceScanResponseDto,
  YieldDto,
} from "@stakekit/api-hooks";
import { Networks } from "@stakekit/common";
import BigNumber from "bignumber.js";
import { List, Maybe } from "purify-ts";
import { tokenString } from "..";
import type { SupportedSKChains } from "./chains";
import type { InitParams } from "./init-params";
import type { PositionsData } from "./positions";
import type { TokenString } from "./tokens";
import { isBittensorStaking } from "./yields";

const amountGreaterThanZero = (val: TokenBalanceScanResponseDto) =>
  new BigNumber(val.amount).isGreaterThan(0);

const hasYields = (val: TokenBalanceScanResponseDto) =>
  !!val.availableYields.length;

const hasYieldsAndAmount = (val: TokenBalanceScanResponseDto) =>
  hasYields(val) && amountGreaterThanZero(val);

export type PreferredTokenYieldsPerNetwork = {
  [Key in SupportedSKChains]?: Record<TokenString, "*" | (YieldDto["id"] & {})>;
};

export const getInitialToken = (args: {
  initQueryParams: Maybe<InitParams>;
  tokenBalances: TokenBalanceScanResponseDto[];
  defaultTokens: TokenBalanceScanResponseDto[];
  network: SupportedSKChains | null;
  preferredTokenYieldsPerNetwork: PreferredTokenYieldsPerNetwork | null;
}) =>
  /**
   * TB based on query params
   */
  args.initQueryParams
    .filter((val) => !!val.token)
    .chain((val) =>
      List.find(
        (t) => {
          const tokenSymbolCompare =
            val.token?.toLowerCase() === t.token.symbol.toLowerCase();

          const tokenNetworkCompare =
            val.network?.toLowerCase() === t.token.network.toLowerCase();

          const tokenStringCompare = tokenString(t.token) === val.token;

          return (
            (tokenSymbolCompare && tokenNetworkCompare) || tokenStringCompare
          );
        },
        [...args.tokenBalances, ...args.defaultTokens]
      )
    )
    /**
     * TB based on preferred token
     */
    .altLazy(() =>
      Maybe.fromNullable(args.network)
        .chain((n) =>
          Maybe.fromNullable(args.preferredTokenYieldsPerNetwork?.[n])
        )
        .altLazy(() =>
          Maybe.fromNullable(args.preferredTokenYieldsPerNetwork).chainNullable(
            (v) => Object.values(v)[0]
          )
        )
        .chain((preferredTokens) =>
          List.find(
            (val) => !!preferredTokens[tokenString(val.token)],
            [...args.tokenBalances, ...args.defaultTokens]
          )
        )
    )
    /**
     * TB based on first token with available yields and amount > 0
     */
    .altLazy(() => List.find(hasYieldsAndAmount, args.tokenBalances))
    /**
     * TB based on first token with available yields
     */
    .altLazy(() => List.find(hasYields, args.tokenBalances))
    .altLazy(() => List.find(hasYields, args.defaultTokens))
    .map((val) => val.token);

export const canBeInitialYield = (args: {
  initQueryParams: Maybe<InitParams>;
  yieldDto: YieldDto;
  tokenBalanceAmount: BigNumber;
  positionsData: PositionsData;
}) =>
  args.initQueryParams
    .chain((queryParams) =>
      Maybe.fromFalsy(
        !!queryParams.yieldId &&
          queryParams.yieldId.toLowerCase() === args.yieldDto.id.toLowerCase()
      )
    )
    .altLazy(() =>
      Maybe.fromFalsy(
        balanceValidForYield({
          tokenBalanceAmount: args.tokenBalanceAmount,
          yieldDto: args.yieldDto,
          positionsData: args.positionsData,
        })
      )
    )
    .isJust();

const balanceValidForYield = ({
  tokenBalanceAmount,
  yieldDto,
  positionsData,
}: {
  tokenBalanceAmount: BigNumber;
  yieldDto: YieldDto;
  positionsData: PositionsData;
}) =>
  tokenBalanceAmount.isGreaterThanOrEqualTo(
    getMinStakeAmount(yieldDto, positionsData)
  );

export const getInitSelectedValidators = (args: {
  initQueryParams: Maybe<InitParams>;
  yieldDto: YieldDto;
}) =>
  args.initQueryParams
    .chainNullable((params) => params.validator)
    .chain((initV) =>
      List.find(
        (val) =>
          val.name?.toLowerCase() === initV.toLowerCase() ||
          val.address === initV,
        args.yieldDto.validators
      )
    )
    .altLazy(() => List.head(args.yieldDto.validators))
    .map((v) => new Map([[v.address, v]]))
    .orDefault(new Map());

export const isForceMaxAmount = (args: AmountArgumentOptionsDto) =>
  args.minimum === -1 && args.maximum === -1;

const yieldsWithEnterMinBasedOnPosition = new Map<
  Networks,
  Set<YieldDto["id"]>
>([[Networks.Polkadot, new Set(["polkadot-dot-validator-staking"])]]);

export const isNetworkWithEnterMinBasedOnPosition = (network: Networks) =>
  yieldsWithEnterMinBasedOnPosition.has(network);

const isYieldWithEnterMinBasedOnPosition = (yieldDto: YieldDto) =>
  Maybe.fromNullable(
    yieldsWithEnterMinBasedOnPosition.get(
      yieldDto.metadata.gasFeeToken.network as Networks
    )
  )
    .filter((set) => set.has(yieldDto.id))
    .isJust();

export const getMinStakeAmount = (
  yieldDto: YieldDto,
  positionsData: PositionsData
) => {
  const integrationMin = new BigNumber(
    yieldDto.args.enter.args?.amount?.minimum ?? 0
  );

  if (isYieldWithEnterMinBasedOnPosition(yieldDto)) {
    const hasStaked = Maybe.fromNullable(positionsData.get(yieldDto.id))
      .map((val) => [...val.balanceData.values()])
      .map((val) =>
        val.some((v) => v.balances.some((b) => b.type === "staked"))
      )
      .orDefault(false);

    if (hasStaked) {
      return new BigNumber(0);
    }

    return integrationMin;
  }

  return integrationMin;
};

export const getMinUnstakeAmount = (
  yieldDto: YieldDto,
  pricePerShare: string | null
) => {
  const integrationMin = new BigNumber(
    yieldDto.args.exit?.args?.amount?.minimum ?? 0
  );

  const pricePerShareBN = new BigNumber(pricePerShare ?? 0);

  if (pricePerShareBN.isZero() || !isBittensorStaking(yieldDto.id)) {
    return integrationMin;
  }

  return integrationMin.dividedBy(pricePerShareBN).decimalPlaces(16);
};
