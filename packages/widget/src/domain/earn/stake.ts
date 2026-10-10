import BigNumber from "bignumber.js";
import { Array as EArray, Option } from "effect";
import { exactDecimal, exactZero } from "../finance/exact";
import type { YieldId } from "../identity/identifiers";
import type { Network } from "../network/network";
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
      integrationMaxLimit ?? exactDecimal(Number.POSITIVE_INFINITY),
      availableAmount.minus(gasEstimateTotal)
    ),
    exactZero()
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
  args:
    | {
        readonly minimum?: string | number | BigNumber | null;
        readonly maximum?: string | number | BigNumber | null;
      }
    | null
    | undefined
) =>
  args?.minimum != null &&
  args?.maximum != null &&
  exactDecimal(args.minimum).isEqualTo(-1) &&
  exactDecimal(args.maximum).isEqualTo(-1);

export const isYieldActionAmountEditable = (
  yieldDto: EarnYieldWithProvider,
  type: "enter" | "exit"
) => {
  const amountArgument = getYieldActionArg(yieldDto, type, "amount");
  return amountArgument != null && !isForceMaxAmount(amountArgument);
};

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

  const maximum = exactDecimal(amountArgument?.maximum ?? 0);

  return {
    maximum: maximum.isGreaterThan(0) ? maximum : null,
    minimum: getMinStakeAmount(yieldDto, selectedYieldHasActivePosition),
    type: "range",
  };
};

const yieldsWithEnterMinBasedOnPosition = new Map<Network, Set<string>>([
  ["polkadot", new Set(["polkadot-dot-validator-staking"])],
]);

const isYieldWithEnterMinBasedOnPosition = (yieldDto: EarnYieldWithProvider) =>
  yieldsWithEnterMinBasedOnPosition
    .get(yieldDto.mechanics.gasFeeToken.network as Network)
    ?.has(yieldDto.id) ?? false;

/**
 * The amount argument minimum is the backend's `subsequentMinimum ?? minimum`,
 * so first entries read `entryLimits.minimum` and holders read
 * `entryLimits.subsequentMinimum`, each falling back toward the argument.
 */
export const getMinStakeAmount = (
  yieldDto: EarnYieldWithProvider,
  selectedYieldHasActivePosition: boolean
) => {
  const entryLimits = yieldDto.mechanics.entryLimits;
  const firstEntryMin = exactDecimal(
    entryLimits?.minimum ??
      getYieldActionArg(yieldDto, "enter", "amount")?.minimum ??
      0
  );

  if (!selectedYieldHasActivePosition) {
    return firstEntryMin;
  }

  if (entryLimits?.subsequentMinimum != null) {
    return exactDecimal(entryLimits.subsequentMinimum);
  }

  if (isYieldWithEnterMinBasedOnPosition(yieldDto)) {
    return exactZero();
  }

  return firstEntryMin;
};

export const getMinUnstakeAmount = (
  yieldDto: EarnYieldWithProvider,
  pricePerShare: string | null
) => {
  const integrationMin = exactDecimal(
    getYieldActionArg(yieldDto, "exit", "amount")?.minimum ?? 0
  );

  const pricePerShareBN = exactDecimal(pricePerShare ?? 0);

  if (pricePerShareBN.isZero() || !isBittensorStaking(yieldDto.id)) {
    return integrationMin;
  }

  return integrationMin.dividedBy(pricePerShareBN).decimalPlaces(16);
};
