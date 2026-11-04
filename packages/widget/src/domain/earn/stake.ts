import BigNumber from "bignumber.js";
import { Schema } from "effect";
import { exactDecimal, exactZero } from "../finance/exact";
import { YieldId } from "../identity/identifiers";
import { equalTokens, type Token } from "../token/token";
import { isConfidentialYield } from "./confidential";
import type { EarnYieldWithProvider } from "./models";
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

export const isForceMaxAmount = (
  args:
    | {
        readonly minimum?: BigNumber | null;
        readonly maximum?: BigNumber | null;
      }
    | null
    | undefined
) => (args?.minimum?.isEqualTo(-1) && args.maximum?.isEqualTo(-1)) === true;

export const isYieldActionAmountEditable = (
  yieldDto: EarnYieldWithProvider,
  type: "enter" | "exit"
) => {
  // Confidential vaults take the amount encrypted, never as plain `amount`.
  if (isConfidentialYield(yieldDto)) {
    return getYieldActionArg(yieldDto, type, "encryptedAmount") != null;
  }
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

  const maximum = amountArgument?.maximum ?? exactZero();

  return {
    maximum: maximum.isGreaterThan(0) ? maximum : null,
    minimum: getMinStakeAmount(yieldDto, selectedYieldHasActivePosition),
    type: "range",
  };
};

const yieldsWithEnterMinBasedOnPosition = new Map<
  Token["network"],
  ReadonlySet<YieldId>
>([
  [
    "polkadot",
    new Set([Schema.decodeSync(YieldId)("polkadot-dot-validator-staking")]),
  ],
]);

const isYieldWithEnterMinBasedOnPosition = (yieldDto: EarnYieldWithProvider) =>
  yieldsWithEnterMinBasedOnPosition
    .get(yieldDto.mechanics.gasFeeToken.network)
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
  const firstEntryMin =
    entryLimits?.minimum ??
    getYieldActionArg(yieldDto, "enter", "amount")?.minimum ??
    exactZero();

  if (!selectedYieldHasActivePosition) {
    return firstEntryMin;
  }

  if (entryLimits?.subsequentMinimum != null) {
    return entryLimits.subsequentMinimum;
  }

  if (isYieldWithEnterMinBasedOnPosition(yieldDto)) {
    return exactZero();
  }

  return firstEntryMin;
};

export const getMinUnstakeAmount = (
  yieldDto: EarnYieldWithProvider,
  pricePerShare: BigNumber | null
) => {
  const integrationMin =
    getYieldActionArg(yieldDto, "exit", "amount")?.minimum ?? exactZero();

  if (
    !pricePerShare ||
    pricePerShare.isZero() ||
    !isBittensorStaking(yieldDto.id)
  ) {
    return integrationMin;
  }

  return integrationMin.dividedBy(pricePerShare).decimalPlaces(16);
};
