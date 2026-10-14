import type BigNumber from "bignumber.js";
import { Array as EArray, Option } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { isBittensorStaking } from "../../../domain/earn/yield";
import { exactDecimal } from "../../../domain/finance/exact";
import type { Prices } from "../../../domain/health/models";
import {
  getYieldEstimatedRewards,
  YieldSummaryKey,
  yieldSummaryAtom,
} from "../../yield-summary/index";
import type { ClassicTransactionFlowIntake } from "../model/classic-transaction-flow";

type ClassicFlowEnterIntake = Extract<
  ClassicTransactionFlowIntake,
  { readonly _tag: "Enter" }
>;

type ClassicStakeReviewResourceView = Readonly<{
  readonly gasAmount: BigNumber | null;
  readonly prices: Prices | null;
}>;

type ClassicFlowPercentageFee = Readonly<{
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
  readonly percentage: string | undefined;
}): ClassicFlowPercentageFee | null =>
  percentage === undefined
    ? null
    : {
        amount: amount.multipliedBy(percentage).dividedBy(100),
        ratio: exactDecimal(percentage).dividedBy(100),
      };

export const makeClassicFlowStakeReviewViewAtom = (
  intake: ClassicFlowEnterIntake,
  reviewAtom: Atom.Atom<ClassicStakeReviewResourceView>
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
    const rewardsTokenSymbol = isBittensorStaking(intake.selectedStake.id)
      ? EArray.head([...intake.selectedValidators.values()]).pipe(
          Option.map((validator) => validator.subnet?.tokenSymbol ?? ""),
          Option.getOrElse(() => intake.selectedToken.symbol)
        )
      : intake.selectedToken.symbol;
    const estimatedRewards = getYieldEstimatedRewards({
      amount: stakeAmount,
      providers: yieldSummary.providers,
      validators: new Map(intake.selectedValidators),
      yield: intake.selectedStake,
    });
    const yieldFee = (
      intake.selectedStake as typeof intake.selectedStake & {
        mechanics?: {
          fee?: {
            deposit?: string;
            management?: string;
            performance?: string;
          };
        };
      }
    ).mechanics?.fee;
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
  }).pipe(Atom.withLabel("classicFlowStakeReviewViewAtom"));
};
