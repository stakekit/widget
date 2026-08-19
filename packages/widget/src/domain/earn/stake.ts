import BigNumber from "bignumber.js";
import { Array as EArray, Option } from "effect";
import type { YieldId } from "../identity/identifiers";
import type { Network } from "../network/network";
import { Networks } from "../network/networks";
import { equalTokens, type Token } from "../token/token";
import type { EarnValidator, EarnYieldWithProvider } from "./models";
import type { ValidatorKey } from "./validator";
import { getYieldActionArg, isBittensorStaking } from "./yield";

export const stakeTokenSameAsGasToken = ({
  stakeToken,
  yieldDto,
}: {
  stakeToken: Token;
  yieldDto: EarnYieldWithProvider;
}) => equalTokens(stakeToken, yieldDto.mechanics.gasFeeToken);

export const getMaxAmount = ({
  availableAmount,
  gasEstimateTotal,
  integrationMaxLimit,
}: {
  availableAmount: BigNumber;
  gasEstimateTotal: BigNumber;
  integrationMaxLimit: BigNumber | null;
}) =>
  BigNumber.max(
    BigNumber.min(
      integrationMaxLimit ?? BigNumber(Number.POSITIVE_INFINITY),
      availableAmount.minus(gasEstimateTotal)
    ),
    new BigNumber(0)
  );

type InitialSelectionParams = {
  readonly validator: string | null;
  readonly yieldId: YieldId | null;
};

export const getInitSelectedValidators = (args: {
  initQueryParams: InitialSelectionParams | null;
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
  args: { minimum?: string | null; maximum?: string | null } | null | undefined
) => args?.minimum === "-1" && args?.maximum === "-1";

type EnterAmountConstraint =
  | { readonly type: "force-max" }
  | {
      readonly maximum: BigNumber | null;
      readonly minimum: BigNumber;
      readonly type: "range";
    };

export const getEnterAmountConstraint = (
  yieldDto: EarnYieldWithProvider,
  selectedYieldHasActivePosition: boolean
): EnterAmountConstraint => {
  const amountArgument = getYieldActionArg(yieldDto, "enter", "amount");

  if (isForceMaxAmount(amountArgument)) {
    return { type: "force-max" };
  }

  const maximum = new BigNumber(amountArgument?.maximum ?? 0);

  return {
    maximum: maximum.isGreaterThan(0) ? maximum : null,
    minimum: getMinStakeAmount(yieldDto, selectedYieldHasActivePosition),
    type: "range",
  };
};

const yieldsWithEnterMinBasedOnPosition = new Map<Network, Set<string>>([
  [Networks.Polkadot, new Set(["polkadot-dot-validator-staking"])],
]);

const isYieldWithEnterMinBasedOnPosition = (yieldDto: EarnYieldWithProvider) =>
  yieldsWithEnterMinBasedOnPosition
    .get(yieldDto.mechanics.gasFeeToken.network as Network)
    ?.has(yieldDto.id) ?? false;

export const getMinStakeAmount = (
  yieldDto: EarnYieldWithProvider,
  selectedYieldHasActivePosition: boolean
) => {
  const integrationMin = new BigNumber(
    getYieldActionArg(yieldDto, "enter", "amount")?.minimum ?? 0
  );

  if (isYieldWithEnterMinBasedOnPosition(yieldDto)) {
    if (selectedYieldHasActivePosition) {
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
