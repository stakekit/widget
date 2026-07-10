import BigNumber from "bignumber.js";
import { List, Maybe } from "purify-ts";
import type { SupportedSKChains } from "./chains";
import { Networks } from "./chains/networks";
import type { InitParams } from "./init-params";
import type { PositionsData } from "./positions";
import type { TokenString } from "./tokens";
import type { Validator, ValidatorKey } from "./validators";
import {
  getYieldActionArg,
  isBittensorStaking,
  type Yield,
  type YieldBase,
} from "./yields";

export type PreferredTokenYieldsPerNetwork = {
  [Key in SupportedSKChains]?: Record<TokenString, "*" | (Yield["id"] & {})>;
};

export const canBeInitialYield = (args: {
  initQueryParams: Maybe<InitParams>;
  yieldDto: YieldBase;
  tokenBalanceAmount: BigNumber;
  positionsData: PositionsData;
}) => {
  const initYieldId = args.initQueryParams
    .chainNullable((queryParams) => queryParams.yieldId)
    .map((yieldId) => yieldId.toLowerCase())
    .extractNullable();

  if (initYieldId) {
    return initYieldId === args.yieldDto.id.toLowerCase();
  }

  return balanceValidForYield({
    tokenBalanceAmount: args.tokenBalanceAmount,
    yieldDto: args.yieldDto,
    positionsData: args.positionsData,
  });
};

const balanceValidForYield = ({
  tokenBalanceAmount,
  yieldDto,
  positionsData,
}: {
  tokenBalanceAmount: BigNumber;
  yieldDto: YieldBase;
  positionsData: PositionsData;
}) =>
  tokenBalanceAmount.isGreaterThanOrEqualTo(
    getMinStakeAmount(yieldDto, positionsData)
  );

export const getInitSelectedValidators = (args: {
  initQueryParams: Maybe<InitParams>;
  validators: Validator[];
}) =>
  args.initQueryParams
    .chainNullable((params) => params.validator)
    .chain((initV) =>
      List.find(
        (val) =>
          val.name?.toLowerCase() === initV.toLowerCase() ||
          val.address === initV,
        args.validators
      )
    )
    .altLazy(() => List.head(args.validators))
    .map((v) => new Map<ValidatorKey, Validator>([[v.key, v]]))
    .orDefault(new Map<ValidatorKey, Validator>());

export const isForceMaxAmount = (
  args: { minimum?: number | null; maximum?: number | null } | null | undefined
) => args?.minimum === -1 && args?.maximum === -1;

const yieldsWithEnterMinBasedOnPosition = new Map<Networks, Set<string>>([
  [Networks.Polkadot, new Set(["polkadot-dot-validator-staking"])],
]);

const isYieldWithEnterMinBasedOnPosition = (yieldDto: YieldBase) =>
  Maybe.fromNullable(
    yieldsWithEnterMinBasedOnPosition.get(
      yieldDto.mechanics.gasFeeToken.network as Networks
    )
  )
    .filter((set) => set.has(yieldDto.id))
    .isJust();

export const getMinStakeAmount = (
  yieldDto: YieldBase,
  positionsData: PositionsData
) => {
  const integrationMin = new BigNumber(
    getYieldActionArg(yieldDto, "enter", "amount")?.minimum ?? 0
  );

  if (isYieldWithEnterMinBasedOnPosition(yieldDto)) {
    const hasStaked = Maybe.fromNullable(positionsData.get(yieldDto.id))
      .map((val) => [...val.balanceData.values()])
      .map((val) =>
        val.some((v) => v.balances.some((b) => b.type === "active"))
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
  pricePerShare: string | null
) => {
  const integrationMin = new BigNumber(
    getYieldActionArg(yieldDto, "exit", "amount")?.minimum ?? 0
  );

  const pricePerShareBN = new BigNumber(pricePerShare ?? 0);

  if (pricePerShareBN.isZero() || !isBittensorStaking(yieldDto.id)) {
    return integrationMin;
  }

  return integrationMin.dividedBy(pricePerShareBN).decimalPlaces(16);
};
