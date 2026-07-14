import BigNumber from "bignumber.js";
import { Array as EArray, Option } from "effect";
import type {
  EarnValidator,
  EarnYieldWithProvider,
} from "../schema/earn-models";
import type { Network } from "../schema/network-model";
import type { SupportedSKChains } from "./chains";
import { Networks } from "./chains/networks";

import type { InitParams } from "./init-params";
import type { PositionsData } from "./positions";
import type { TokenString } from "./tokens";
import type { ValidatorKey } from "./validators";
import { getYieldActionArg, isBittensorStaking } from "./yields";

export type PreferredTokenYieldsPerNetwork = {
  [Key in SupportedSKChains]?: Record<
    TokenString,
    "*" | (EarnYieldWithProvider["id"] & {})
  >;
};

export const canBeInitialYield = (args: {
  initQueryParams: InitParams | null;
  yieldDto: EarnYieldWithProvider;
  tokenBalanceAmount: BigNumber;
  positionsData: PositionsData;
}) => {
  const initYieldId = args.initQueryParams?.yieldId?.toLowerCase() ?? null;

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
  yieldDto: EarnYieldWithProvider;
  positionsData: PositionsData;
}) =>
  tokenBalanceAmount.isGreaterThanOrEqualTo(
    getMinStakeAmount(yieldDto, positionsData)
  );

export const getInitSelectedValidators = (args: {
  initQueryParams: InitParams | null;
  validators: ReadonlyArray<EarnValidator>;
}) => {
  const initValidator = args.initQueryParams?.validator;
  const selected =
    (initValidator
      ? EArray.findFirst(
          args.validators,
          (validator) =>
            validator.name?.toLowerCase() === initValidator.toLowerCase() ||
            validator.address === initValidator
        ).pipe(Option.getOrUndefined)
      : undefined) ?? EArray.head(args.validators).pipe(Option.getOrUndefined);

  return selected
    ? new Map<ValidatorKey, EarnValidator>([[selected.key, selected]])
    : new Map<ValidatorKey, EarnValidator>();
};

export const isForceMaxAmount = (
  args: { minimum?: number | null; maximum?: number | null } | null | undefined
) => args?.minimum === -1 && args?.maximum === -1;

const yieldsWithEnterMinBasedOnPosition = new Map<Network, Set<string>>([
  [Networks.Polkadot, new Set(["polkadot-dot-validator-staking"])],
]);

const isYieldWithEnterMinBasedOnPosition = (yieldDto: EarnYieldWithProvider) =>
  yieldsWithEnterMinBasedOnPosition
    .get(yieldDto.mechanics.gasFeeToken.network as Network)
    ?.has(yieldDto.id) ?? false;

export const getMinStakeAmount = (
  yieldDto: EarnYieldWithProvider,
  positionsData: PositionsData
) => {
  const integrationMin = new BigNumber(
    getYieldActionArg(yieldDto, "enter", "amount")?.minimum ?? 0
  );

  if (isYieldWithEnterMinBasedOnPosition(yieldDto)) {
    const hasStaked = EArray.some(
      Array.from(positionsData.get(yieldDto.id)?.balanceData.values() ?? []),
      (position) =>
        EArray.some(position.balances, (balance) => balance.type === "active")
    );

    if (hasStaked) {
      return new BigNumber(0);
    }

    return integrationMin;
  }

  return integrationMin;
};

export const getMinUnstakeAmount = (
  yieldDto: EarnYieldWithProvider,
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
