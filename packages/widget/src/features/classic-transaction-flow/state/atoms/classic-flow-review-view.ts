import { Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import type { YieldAction } from "../../../../domain/action/models";
import { getTransactionGasEstimate } from "../../../../domain/action/rules";
import { exactZero } from "../../../../domain/finance/exact";
import { checkGasAmount } from "../../../../domain/finance/gas";
import type { GasBalancesCommand } from "../../../../domain/finance/models";
import {
  GasTokenBalancesKey,
  gasTokenBalancesResourceAtom,
} from "../../../../resources/gas-token-balances/index";
import {
  getTokensPricesRequest,
  PricesKey,
  pricesAtom,
} from "../../../../resources/token-prices/index";
import type { CurrentYieldKycGate } from "../../../yield-summary/index";
import {
  type ClassicTransactionFlowIntake,
  getClassicTransactionFlowGasWarningInput,
  getClassicTransactionFlowReviewPricingInput,
} from "../../model/classic-transaction-flow";

const getGasAmount = (action: YieldAction | null) => {
  if (!action) return null;

  const total = action.transactions.reduce((sum, transaction) => {
    const decoded = getTransactionGasEstimate(transaction);
    return sum.plus(decoded?.amount ?? 0);
  }, exactZero());

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

export const makeClassicFlowSessionReviewResources = ({
  actionPreviewAtom,
  activityExpiredAtom,
  intakeAtom,
  kycGateAtom,
}: {
  readonly actionPreviewAtom: Atom.Atom<
    AsyncResult.AsyncResult<YieldAction | null, { readonly retryable: boolean }>
  >;
  readonly activityExpiredAtom: Atom.Atom<boolean>;
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
      confirmDisabled: kyc.isBlocking || previewError?.retryable === false,
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
    if (intake._tag !== "YieldActionContinuation") {
      throw new Error("Expected Yield Action Continuation intake.");
    }

    const view = get(reviewViewAtom);
    return {
      confirmDisabled: view.confirmDisabled || get(activityExpiredAtom),
      confirmLoading: view.confirmLoading,
    } as const;
  }).pipe(Atom.withLabel("classicFlowSessionActivityReviewViewAtom"));

  return {
    activityReviewViewAtom,
    reviewViewAtom,
  } as const;
};
