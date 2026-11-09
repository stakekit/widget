import type BigNumber from "bignumber.js";
import { Array as EArray, Option } from "effect";
import type { YieldAction } from "../../../domain/action/models";
import {
  getActionInputToken,
  getTransactionGasEstimate,
} from "../../../domain/action/rules";
import { isBittensorStaking } from "../../../domain/earn/yield";
import type { EarnYieldWithProvider } from "../../../domain/earn/yield-schema";
import { exactDecimal } from "../../../domain/finance/exact";
import type { Token } from "../../../domain/token/token";
import type { WalletScopeKey } from "../../../domain/wallet/wallet-scope";
import type {
  EnterYieldTransactionFlowIntake,
  YieldTransactionFlowIntake,
} from "./intake";

/**
 * What the flow's transactions are estimated to cost in the gas token: the
 * action's, plus the conversion before it. Null when any part is unknown, so
 * no partial total shows.
 */
export const getYieldFlowGasAmount = (
  action: YieldAction | null,
  conversionGas: BigNumber | null
) => {
  if (!action || !conversionGas) return null;

  const estimates = action.transactions.map(getTransactionGasEstimate);
  if (estimates.some((estimate) => !estimate)) return null;

  const total = estimates.reduce(
    (sum, estimate) => sum.plus(estimate?.amount ?? 0),
    conversionGas
  );

  return total.isZero() ? null : total;
};

type YieldTransactionFlowReviewPricingInput = {
  readonly token: Token;
  readonly yield: EarnYieldWithProvider;
};

export const getYieldTransactionFlowReviewPricingInput = (
  intake: YieldTransactionFlowIntake
): YieldTransactionFlowReviewPricingInput | null => {
  switch (intake._tag) {
    case "Enter":
      return { token: intake.selectedToken, yield: intake.selectedStake };
    case "Exit":
      return { token: intake.unstakeToken, yield: intake.integration };
    case "Manage":
      return { token: intake.interactedToken, yield: intake.integration };
    case "YieldActionContinuation": {
      const token = getActionInputToken({
        actionDto: intake.action,
        yieldDto: intake.selectedYield,
      });
      return token ? { token, yield: intake.selectedYield } : null;
    }
  }
};

/**
 * The symbol a deposit's rewards are paid in: a Bittensor subnet's own
 * token, else the deposited token.
 */
export const getYieldFlowRewardsTokenSymbol = (
  intake: EnterYieldTransactionFlowIntake
) =>
  isBittensorStaking(intake.selectedStake.id)
    ? EArray.head([...intake.selectedValidators.values()]).pipe(
        Option.map((validator) => validator.subnet?.tokenSymbol ?? ""),
        Option.getOrElse(() => intake.selectedToken.symbol)
      )
    : intake.selectedToken.symbol;

type YieldTransactionFlowGasWarningInput = {
  readonly gasFeeToken: Token;
  readonly stakeAmount: BigNumber | null;
  readonly stakeToken: Token | null;
  readonly walletScope: WalletScopeKey;
};

export const getYieldTransactionFlowGasWarningInput = (
  intake: YieldTransactionFlowIntake
): YieldTransactionFlowGasWarningInput =>
  intake._tag === "Enter"
    ? {
        gasFeeToken: intake.gasFeeToken,
        stakeAmount: exactDecimal(intake.request.arguments?.amount ?? 0),
        stakeToken: intake.selectedToken,
        walletScope: intake.walletScope,
      }
    : {
        gasFeeToken:
          intake._tag === "YieldActionContinuation"
            ? intake.selectedYield.mechanics.gasFeeToken
            : intake.gasFeeToken,
        stakeAmount: null,
        stakeToken: null,
        walletScope: intake.walletScope,
      };
