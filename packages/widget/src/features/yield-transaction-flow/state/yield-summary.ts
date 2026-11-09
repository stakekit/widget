import type BigNumber from "bignumber.js";
import * as Atom from "effect/reactivity/Atom";
import { isConfidentialYield } from "../../../domain/earn/confidential";
import { getYieldOutputAmount } from "../../../domain/earn/yield";
import { exactDecimal } from "../../../domain/finance/exact";
import { getTokenPriceInUSD } from "../../../domain/finance/price";
import type { Prices } from "../../../domain/health/models";
import {
  getYieldEstimatedRewards,
  YieldSummaryKey,
  yieldSummaryAtom,
} from "../../yield-summary/index";
import type { YieldTransactionFlowIntake } from "../model/intake";
import { getYieldFlowRewardsTokenSymbol } from "../model/pricing";

type YieldFlowEnterIntake = Extract<
  YieldTransactionFlowIntake,
  { readonly _tag: "Enter" }
>;

type YieldFlowExitIntake = Extract<
  YieldTransactionFlowIntake,
  { readonly _tag: "Exit" }
>;

type YieldStakeReviewResourceView = Readonly<{
  readonly gasAmount: BigNumber | null;
  readonly prices: Prices | null;
}>;

type YieldFlowPercentageFee = Readonly<{
  /** Fee charged on the stake amount, in the selected token. */
  readonly amount: BigNumber;
  /** Fee as a decimal ratio (e.g. 0.005 for 0.5%). */
  readonly ratio: BigNumber;
}>;

const makePercentageFee = ({
  amount,
  percentage,
}: {
  readonly amount: BigNumber;
  readonly percentage: BigNumber | null | undefined;
}): YieldFlowPercentageFee | null =>
  percentage == null
    ? null
    : {
        amount: amount.multipliedBy(percentage).dividedBy(100),
        ratio: percentage.dividedBy(100),
      };

/**
 * The withdrawal fee an exit pays on its amount, in the exited token; null
 * when the yield charges none.
 */
export const getYieldFlowWithdrawalFee = (intake: YieldFlowExitIntake) => {
  const percentage = intake.integration.mechanics.fee?.withdrawal;

  return percentage?.isGreaterThan(0)
    ? makePercentageFee({
        amount: exactDecimal(intake.request.arguments?.amount ?? 0),
        percentage,
      })
    : null;
};

export const makeYieldFlowStakeReviewViewAtom = (
  intake: YieldFlowEnterIntake,
  reviewAtom: Atom.Atom<YieldStakeReviewResourceView>
) => {
  const stakeAmount = exactDecimal(intake.request.arguments?.amount ?? 0);
  const summaryAtom = yieldSummaryAtom(
    new YieldSummaryKey({
      validators: new Map(intake.selectedValidators),
      yield: intake.selectedStake,
    })
  );

  return Atom.make((get) => {
    const review = get(reviewAtom);
    const yieldSummary = get(summaryAtom);
    const rewardsTokenSymbol = getYieldFlowRewardsTokenSymbol(intake);
    const estimatedRewards = getYieldEstimatedRewards({
      amount: stakeAmount,
      providers: yieldSummary.providers,
      validators: new Map(intake.selectedValidators),
      yield: intake.selectedStake,
    });
    const yieldFee = intake.selectedStake.mechanics.fee;
    const feeInput = { amount: stakeAmount };

    return {
      depositFee: makePercentageFee({
        ...feeInput,
        percentage: yieldFee?.deposit,
      }),
      estimatedRewards,
      gasAmount: review.gasAmount,
      managementFee: makePercentageFee({
        ...feeInput,
        percentage: yieldFee?.management,
      }),
      performanceFee: makePercentageFee({
        ...feeInput,
        percentage: yieldFee?.performance,
      }),
      prices: review.prices,
      rewardToken: yieldSummary.rewardToken,
      rewardsTokenSymbol,
      stakeAmount,
    } as const;
  }).pipe(Atom.withLabel("yieldFlowStakeReviewViewAtom"));
};

/**
 * Complete's view of a finished deposit: its amount; what it received in
 * the yield's own token, unless it is batched and receives its shares once
 * the batch settles; and a year's rewards on it, as Review estimated them,
 * with their fiat value only when they are paid in the deposited token.
 */
export const makeYieldFlowEnterCompleteViewAtom = (
  intake: YieldFlowEnterIntake,
  pricingAtom: Atom.Atom<Readonly<{ readonly prices: Prices | null }>>
) => {
  const amount = exactDecimal(intake.request.arguments?.amount ?? 0);
  const validators = new Map(intake.selectedValidators);
  const summaryAtom = yieldSummaryAtom(
    new YieldSummaryKey({ validators, yield: intake.selectedStake })
  );
  const batched = isConfidentialYield(intake.selectedStake);
  const received = batched
    ? null
    : getYieldOutputAmount(intake.selectedStake, amount);
  const rewardsTokenSymbol = getYieldFlowRewardsTokenSymbol(intake);

  return Atom.make((get) => {
    const yieldSummary = get(summaryAtom);
    const { prices } = get(pricingAtom);
    const yearly = getYieldEstimatedRewards({
      amount,
      providers: yieldSummary.providers,
      validators,
      yield: intake.selectedStake,
    })?.yearly;
    const yearlyUsd =
      yearly && prices && rewardsTokenSymbol === intake.selectedToken.symbol
        ? getTokenPriceInUSD({
            amount: yearly,
            baseToken: null,
            pricePerShare: null,
            prices,
            token: intake.selectedToken,
          })
        : null;

    return {
      amount,
      batched,
      received,
      yearlyEarnings: yearly
        ? {
            amount: yearly,
            symbol: rewardsTokenSymbol,
            usd: yearlyUsd?.isGreaterThan(0) ? yearlyUsd : null,
          }
        : null,
      yieldType: yieldSummary.yieldType,
    } as const;
  }).pipe(Atom.withLabel("yieldFlowEnterCompleteViewAtom"));
};
