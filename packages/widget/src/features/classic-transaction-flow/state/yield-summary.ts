import BigNumber from "bignumber.js";
import { Array as EArray, Option } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { getActionProviderYieldId } from "../../../domain/action/rules";
import { isBittensorStaking } from "../../../domain/earn/yield";
import type { Prices } from "../../../domain/health/models";
import { getFeesInUSD, getGasFeeInUSD } from "../../../shared/lib/formatters";
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

const makePercentageFee = ({
  amount,
  percentage,
  prices,
  token,
}: {
  readonly amount: BigNumber;
  readonly percentage: string | undefined;
  readonly prices: Prices | null;
  readonly token: ClassicFlowEnterIntake["selectedToken"];
}) =>
  percentage === undefined
    ? null
    : {
        inPercentage: `${percentage}%`,
        inUSD: getFeesInUSD({
          amount: amount.multipliedBy(percentage).dividedBy(100),
          prices,
          token,
        }),
      };

export const makeClassicFlowStakeReviewViewAtom = (
  intake: ClassicFlowEnterIntake,
  reviewAtom: Atom.Atom<ClassicStakeReviewResourceView>
) => {
  const stakeAmount = new BigNumber(intake.request.arguments?.amount ?? 0);
  const summaryAtom = yieldSummaryAtom(
    new YieldSummaryKey({
      selectedProviderYieldId: getActionProviderYieldId(intake.request),
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
    const feeInput = {
      amount: stakeAmount,
      prices: review.prices,
      token: intake.selectedToken,
    };

    return {
      depositFee: makePercentageFee({
        ...feeInput,
        percentage: yieldFee?.deposit,
      }),
      estimatedRewards,
      gasFee: getGasFeeInUSD({
        gas: review.gasAmount,
        prices: review.prices,
        yieldDto: intake.selectedStake,
      }),
      managementFee: makePercentageFee({
        ...feeInput,
        percentage: yieldFee?.management,
      }),
      performanceFee: makePercentageFee({
        ...feeInput,
        percentage: yieldFee?.performance,
      }),
      rewardToken: yieldSummary.rewardToken,
      rewardsTokenSymbol,
      stakeAmount,
    } as const;
  }).pipe(Atom.withLabel("classicFlowStakeReviewViewAtom"));
};
