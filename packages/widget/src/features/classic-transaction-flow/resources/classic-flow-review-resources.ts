import BigNumber from "bignumber.js";
import { DateTime, Duration, Option, Schedule, Stream } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import type { YieldAction } from "../../../domain/schema/action-models";
import type { GasBalancesCommand } from "../../../domain/schema/financial-models";
import { getTransactionGasEstimate } from "../../../domain/types/action";
import { checkGasAmount } from "../../../domain/types/gas";
import {
  GasTokenBalancesKey,
  gasTokenBalancesResourceAtom,
} from "../../../resources/gas-token-balances/gas-token-balances";
import {
  getTokensPricesRequest,
  PricesKey,
  pricesAtom,
} from "../../../resources/token-prices/prices";
import type { CurrentYieldKycGate } from "../../yield-summary/state";
import {
  type ClassicTransactionFlowIntake,
  getClassicTransactionFlowGasWarningInput,
  getClassicTransactionFlowReviewPricingInput,
} from "../model/classic-transaction-flow";

const getGasAmount = (action: YieldAction | null) => {
  if (!action) return null;

  const total = action.transactions.reduce((sum, transaction) => {
    const decoded = getTransactionGasEstimate(transaction);
    return sum.plus(decoded?.amount ?? 0);
  }, new BigNumber(0));

  return total.isZero() ? null : total;
};

const getGasBalancesCommand = (
  input: NonNullable<
    ReturnType<typeof getClassicTransactionFlowGasWarningInput>
  >
): GasBalancesCommand => {
  const { additionalAddresses, address } = input.walletScope;

  return {
    addresses: [
      {
        address,
        ...(additionalAddresses ? { additionalAddresses } : {}),
        network: input.gasFeeToken.network,
        ...(input.gasFeeToken.address
          ? { tokenAddress: input.gasFeeToken.address }
          : {}),
      },
    ],
  };
};

export const makeClassicFlowActivityActionExpiredAtom = (
  intakeAtom: Atom.Atom<ClassicTransactionFlowIntake>
) => {
  const activityActionExpiredResourceAtom = Atom.make((get) => {
    const intake = get(intakeAtom);
    if (intake._tag !== "ActivityResume") {
      throw new Error("Expected Classic Flow ActivityResume intake.");
    }

    return Stream.fromEffectSchedule(
      DateTime.now,
      Schedule.spaced("1 minute")
    ).pipe(
      Stream.map((now) =>
        Duration.isGreaterThanOrEqualTo(
          DateTime.distance(intake.action.createdAt, now),
          Duration.days(7)
        )
      )
    );
  }).pipe(Atom.withLabel("classicFlowActivityActionExpiredResourceAtom"));

  return Atom.make((get) =>
    AsyncResult.getOrElse(get(activityActionExpiredResourceAtom), () => true)
  ).pipe(Atom.withLabel("classicFlowActivityActionExpiredAtom"));
};

export const makeClassicFlowSessionReviewResources = ({
  actionPreviewAtom,
  activityActionExpiredAtom,
  intakeAtom,
  kycGateAtom,
}: {
  readonly actionPreviewAtom: Atom.Atom<
    AsyncResult.AsyncResult<YieldAction | null, { readonly retryable: boolean }>
  >;
  readonly activityActionExpiredAtom: Atom.Atom<boolean>;
  readonly intakeAtom: Atom.Atom<ClassicTransactionFlowIntake>;
  readonly kycGateAtom: Atom.Atom<CurrentYieldKycGate>;
}) => {
  const reviewPricesAtom = Atom.make((get) => {
    const input = getClassicTransactionFlowReviewPricingInput(get(intakeAtom));
    const request = input
      ? getTokensPricesRequest({ token: input.token, yieldDto: input.yield })
      : null;

    return get(pricesAtom.foreground(new PricesKey({ request })));
  }).pipe(Atom.withLabel("classicFlowSessionReviewPricesAtom"));

  const reviewActionAtom = Atom.make((get) =>
    get(actionPreviewAtom).pipe(AsyncResult.value, Option.getOrNull)
  );

  const gasAmountAtom = Atom.make((get) =>
    getGasAmount(get(reviewActionAtom))
  ).pipe(Atom.withLabel("classicFlowSessionGasAmountAtom"));

  const gasWarningAtom = Atom.make((get) => {
    const input = getClassicTransactionFlowGasWarningInput(get(intakeAtom));
    const gasAmount = get(gasAmountAtom);

    if (!input || !gasAmount) return AsyncResult.success(null);

    return get(
      gasTokenBalancesResourceAtom.foreground(
        new GasTokenBalancesKey({
          command: getGasBalancesCommand(input),
        })
      )
    ).pipe(
      AsyncResult.map((balances) =>
        checkGasAmount({
          gasEstimate: gasAmount,
          gasTokenBalance: balances[0],
          ...(input.stakeAmount && input.stakeToken
            ? {
                isStake: true as const,
                stakeAmount: input.stakeAmount,
                stakeToken: input.stakeToken,
              }
            : { isStake: false as const }),
        })
      )
    );
  }).pipe(Atom.withLabel("classicFlowSessionGasWarningAtom"));

  const reviewViewAtom = Atom.make((get) => {
    const actionPreview = get(actionPreviewAtom);
    const gasWarning = get(gasWarningAtom);
    const kyc = get(kycGateAtom);
    const previewError = actionPreview.pipe(
      AsyncResult.error,
      Option.getOrNull
    );
    const actionPreviewLoading =
      AsyncResult.isInitial(actionPreview) || actionPreview.waiting;

    return {
      action: get(reviewActionAtom),
      actionPreviewLoading,
      confirmDisabled: kyc.isGateBlocking || previewError?.retryable === false,
      confirmLoading: actionPreviewLoading || kyc.isLoading,
      gasAmount: get(gasAmountAtom),
      gasCheckLoading:
        actionPreviewLoading ||
        AsyncResult.isInitial(gasWarning) ||
        gasWarning.waiting,
      isGasCheckWarning: gasWarning.pipe(
        AsyncResult.value,
        Option.match({ onNone: () => false, onSome: Boolean })
      ),
      kyc,
      prices: AsyncResult.getOrElse(get(reviewPricesAtom), () => null),
    } as const;
  }).pipe(Atom.withLabel("classicFlowSessionReviewViewAtom"));

  const activityReviewViewAtom = Atom.make((get) => {
    const intake = get(intakeAtom);
    if (intake._tag !== "ActivityResume") {
      throw new Error("Expected Classic Flow ActivityResume intake.");
    }

    const view = get(reviewViewAtom);
    const actionExpired = get(activityActionExpiredAtom);
    return {
      ...view,
      action: view.action ?? intake.action,
      actionExpired,
      confirmDisabled: view.confirmDisabled || actionExpired,
      selectedYield: intake.selectedYield,
    } as const;
  }).pipe(Atom.withLabel("classicFlowSessionActivityReviewViewAtom"));

  return {
    activityActionExpiredAtom,
    activityReviewViewAtom,
    reviewViewAtom,
  } as const;
};
