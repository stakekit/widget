import BigNumber from "bignumber.js";
import { Data, Duration, Effect, Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../../app/runtime/app-runtime";
import type { YieldAction } from "../../../domain/schema/action-models";
import type { GasBalancesCommand } from "../../../domain/schema/financial-models";
import { getTransactionGasEstimate } from "../../../domain/types/action";
import { checkGasAmount } from "../../../domain/types/gas";
import { LegacyApiService } from "../../../services/api/legacy-api-service";
import { withApiResourcePolicy } from "../../../shared/effect/api-resource";
import {
  getTokensPricesRequest,
  PricesKey,
  pricesAtom,
} from "../../earn/resources/prices";
import type { CurrentYieldKycGate } from "../../earn/resources/yield-insights";
import {
  type ClassicTransactionFlowIntake,
  getClassicTransactionFlowGasWarningInput,
  getClassicTransactionFlowReviewPricingInput,
} from "../model/classic-transaction-flow";

class ClassicFlowGasBalancesKey extends Data.Class<{
  readonly command: GasBalancesCommand;
}> {}

const gasBalancesAtom = Atom.family((key: ClassicFlowGasBalancesKey) =>
  appRuntime
    .atom(
      Effect.gen(function* () {
        const api = yield* LegacyApiService;
        return yield* api.getGasTokenBalances(key.command);
      })
    )
    .pipe(
      withApiResourcePolicy({
        idleTTL: Duration.minutes(5),
        revalidateOnMount: true,
        staleTime: Duration.zero,
      })
    )
);

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

export const makeClassicFlowSessionReviewResources = ({
  actionPreviewAtom,
  attachedActionAtom,
  intakeAtom,
  kycGateAtom,
}: {
  readonly actionPreviewAtom: Atom.Atom<
    AsyncResult.AsyncResult<YieldAction | null, unknown>
  >;
  readonly attachedActionAtom: Atom.Atom<YieldAction | null>;
  readonly intakeAtom: Atom.Atom<ClassicTransactionFlowIntake>;
  readonly kycGateAtom: Atom.Atom<CurrentYieldKycGate>;
}) => {
  const reviewPricesAtom = Atom.make((get) => {
    const input = getClassicTransactionFlowReviewPricingInput(get(intakeAtom));
    const request = input
      ? getTokensPricesRequest({ token: input.token, yieldDto: input.yield })
      : null;

    return get(pricesAtom(new PricesKey({ request })));
  }).pipe(Atom.withLabel("classicFlowSessionReviewPricesAtom"));

  const reviewActionAtom = Atom.make((get) => {
    const attachedAction = get(attachedActionAtom);
    const previewAction = get(actionPreviewAtom).pipe(
      AsyncResult.value,
      Option.getOrNull
    );

    return attachedAction ?? previewAction;
  });

  const gasAmountAtom = Atom.make((get) =>
    getGasAmount(get(reviewActionAtom))
  ).pipe(Atom.withLabel("classicFlowSessionGasAmountAtom"));

  const gasWarningAtom = Atom.make((get) => {
    const input = getClassicTransactionFlowGasWarningInput(get(intakeAtom));
    const gasAmount = get(gasAmountAtom);

    if (!input || !gasAmount) return AsyncResult.success(null);

    return get(
      gasBalancesAtom(
        new ClassicFlowGasBalancesKey({
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

  const refreshGasWarningAtom = Atom.fnSync(
    (_input: undefined, get) => {
      const input = getClassicTransactionFlowGasWarningInput(get(intakeAtom));
      if (input) {
        get.refresh(
          gasBalancesAtom(
            new ClassicFlowGasBalancesKey({
              command: getGasBalancesCommand(input),
            })
          )
        );
      }
    },
    { initialValue: undefined }
  ).pipe(Atom.withLabel("refreshClassicFlowSessionGasWarningAtom"));

  const reviewViewAtom = Atom.make((get) => {
    const actionPreview = get(actionPreviewAtom);
    const gasWarning = get(gasWarningAtom);
    const kyc = get(kycGateAtom);
    const actionPreviewLoading =
      AsyncResult.isInitial(actionPreview) || actionPreview.waiting;

    return {
      actionPreviewLoading,
      confirmDisabled: kyc.isGateBlocking,
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

  return {
    gasAmountAtom,
    gasWarningAtom,
    refreshGasWarningAtom,
    reviewPricesAtom,
    reviewViewAtom,
  } as const;
};
