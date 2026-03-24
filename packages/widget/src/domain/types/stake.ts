import type { TokenBalanceScanResponseDto } from "@stakekit/api-hooks";
import { Networks } from "@stakekit/common";
import BigNumber from "bignumber.js";
import { List, Maybe } from "purify-ts";
import { tokenString } from "..";
import type { SupportedSKChains } from "./chains";
import type { InitParams } from "./init-params";
import type { PositionsData } from "./positions";
import type { TokenString } from "./tokens";
import type { ValidatorDto } from "./validators";
import {
  getYieldActionArg,
  getYieldGasFeeToken,
  isBittensorStaking,
  type Yield,
} from "./yields";

const amountGreaterThanZero = (val: TokenBalanceScanResponseDto) =>
  new BigNumber(val.amount).isGreaterThan(0);

const hasYields = (val: TokenBalanceScanResponseDto) =>
  !!val.availableYields.length;

const hasYieldsAndAmount = (val: TokenBalanceScanResponseDto) =>
  hasYields(val) && amountGreaterThanZero(val);

export type PreferredTokenYieldsPerNetwork = {
  [Key in SupportedSKChains]?: Record<TokenString, "*" | (Yield["id"] & {})>;
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
        [...args.tokenBalances, ...args.defaultTokens],
      ),
    )
    /**
     * TB based on preferred token
     */
    .altLazy(() =>
      Maybe.fromNullable(args.network)
        .chain((n) =>
          Maybe.fromNullable(args.preferredTokenYieldsPerNetwork?.[n]),
        )
        .altLazy(() =>
          Maybe.fromNullable(args.preferredTokenYieldsPerNetwork).chainNullable(
            (v) => Object.values(v)[0],
          ),
        )
        .chain((preferredTokens) =>
          List.find(
            (val) => !!preferredTokens[tokenString(val.token)],
            [...args.tokenBalances, ...args.defaultTokens],
          ),
        ),
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
    .altLazy(() => List.head(args.defaultTokens))
    .map((val) => val.token);

export const canBeInitialYield = (args: {
  initQueryParams: Maybe<InitParams>;
  yieldDto: Yield;
  tokenBalanceAmount: BigNumber;
  positionsData: PositionsData;
}) =>
  args.initQueryParams
    .chain((queryParams) =>
      Maybe.fromFalsy(
        !!queryParams.yieldId &&
          queryParams.yieldId.toLowerCase() === args.yieldDto.id.toLowerCase(),
      ),
    )
    .altLazy(() =>
      Maybe.fromFalsy(
        balanceValidForYield({
          tokenBalanceAmount: args.tokenBalanceAmount,
          yieldDto: args.yieldDto,
          positionsData: args.positionsData,
        }),
      ),
    )
    .isJust();

const balanceValidForYield = ({
  tokenBalanceAmount,
  yieldDto,
  positionsData,
}: {
  tokenBalanceAmount: BigNumber;
  yieldDto: Yield;
  positionsData: PositionsData;
}) =>
  tokenBalanceAmount.isGreaterThanOrEqualTo(
    getMinStakeAmount(yieldDto, positionsData),
  );

export const getInitSelectedValidators = (args: {
  initQueryParams: Maybe<InitParams>;
  validators: ValidatorDto[];
}) =>
  args.initQueryParams
    .chainNullable((params) => params.validator)
    .chain((initV) =>
      List.find(
        (val) =>
          val.name?.toLowerCase() === initV.toLowerCase() ||
          val.address === initV,
        args.validators,
      ),
    )
    .altLazy(() => List.head(args.validators))
    .map((v) => new Map([[v.address, v]]))
    .orDefault(new Map());

export const isForceMaxAmount = (
  args: { minimum?: number | null; maximum?: number | null } | null | undefined,
) => args?.minimum === -1 && args?.maximum === -1;

const yieldsWithEnterMinBasedOnPosition = new Map<Networks, Set<Yield["id"]>>([
  [Networks.Polkadot, new Set(["polkadot-dot-validator-staking"])],
]);

export const isNetworkWithEnterMinBasedOnPosition = (network: Networks) =>
  yieldsWithEnterMinBasedOnPosition.has(network);

const isYieldWithEnterMinBasedOnPosition = (yieldDto: Yield) =>
  Maybe.fromNullable(
    yieldsWithEnterMinBasedOnPosition.get(
      getYieldGasFeeToken(yieldDto).network as Networks,
    ),
  )
    .filter((set) => set.has(yieldDto.id))
    .isJust();

export const getMinStakeAmount = (
  yieldDto: Yield,
  positionsData: PositionsData,
) => {
  const integrationMin = new BigNumber(
    getYieldActionArg(yieldDto, "enter", "amount")?.minimum ?? 0,
  );

  if (isYieldWithEnterMinBasedOnPosition(yieldDto)) {
    const hasStaked = Maybe.fromNullable(positionsData.get(yieldDto.id))
      .map((val) => [...val.balanceData.values()])
      .map((val) =>
        val.some((v) => v.balances.some((b) => b.type === "active")),
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
  yieldDto: Yield,
  pricePerShare: string | null,
) => {
  const integrationMin = new BigNumber(
    getYieldActionArg(yieldDto, "exit", "amount")?.minimum ?? 0,
  );

  const pricePerShareBN = new BigNumber(pricePerShare ?? 0);

  if (pricePerShareBN.isZero() || !isBittensorStaking(yieldDto.id)) {
    return integrationMin;
  }

  return integrationMin.dividedBy(pricePerShareBN).decimalPlaces(16);
};
