import type BigNumber from "bignumber.js";
import { Data, Effect, Option, Predicate, Ref, Result } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { walletRuntime } from "../../../app/runtime/wallet-runtime";
import { getDirectTransactionFallbackGas } from "../../../domain/action/direct-transaction";
import type { YieldAction } from "../../../domain/action/models";
import {
  getTransactionGasEstimate,
  getValidStakeSessionTx,
} from "../../../domain/action/rules";
import { isContinuableYieldAction } from "../../../domain/activity/action-capabilities";
import { getConfidentialRedeemOperators } from "../../../domain/earn/confidential";
import { exactDecimal, exactZero } from "../../../domain/finance/exact";
import { checkGasAmount } from "../../../domain/finance/gas";
import type { Token } from "../../../domain/token/token";
import {
  GasTokenBalancesKey,
  gasTokenBalancesResourceAtom,
} from "../../../resources/gas-token-balances/index";
import {
  getTokensPricesRequest,
  PricesKey,
  pricesAtom,
} from "../../../resources/token-prices/index";
import {
  type ActionPreviewRequest,
  YieldOperations,
} from "../../../services/api/operations";
import { EvmRpc } from "../../../services/evm-rpc/evm-rpc";
import {
  WidgetNavigation,
  type WidgetNavigationError,
} from "../../../services/navigation/widget-navigation";
import { TrackingService } from "../../../services/tracking/tracking-service";
import {
  type ConfidentialPreparation,
  prepareConfidentialCommand,
  ZamaService,
} from "../../../services/zama/zama-service";
import { toPresentable } from "../../../shared/effect/async-result";
import { presentationClockAtom } from "../../../shared/effect/presentation-clock";
import {
  CurrentYieldKycGateKey,
  currentYieldKycGateAtom,
  refreshCurrentYieldKycAtom,
} from "../../yield-summary/index";
import {
  getYieldFlowConfidentialPreparation,
  getYieldFlowPlannedStepTypes,
  getYieldTransactionFlowGasWarningInput,
  getYieldTransactionFlowKycYield,
  getYieldTransactionFlowReviewPricingInput,
  type YieldFlowExecutionSource,
  YieldFlowHandoff,
  type YieldFlowSession,
  type YieldPreviewIntake,
  type YieldTransactionFlowIntake,
} from "../model/yield-transaction-flow";
import { makeYieldFlowStakeReviewViewAtom } from "./yield-summary";

class YieldFlowPreviewError extends Data.TaggedError("YieldFlowPreviewError")<{
  readonly cause: unknown;
  readonly message: string;
  readonly retryable: true;
}> {}

class YieldFlowInvalidPreviewError extends Data.TaggedError(
  "YieldFlowInvalidPreviewError"
)<{
  readonly cause: unknown;
  readonly message: string;
  readonly retryable: false;
}> {}

class YieldFlowInvalidPreviewRequestError extends Data.TaggedError(
  "YieldFlowInvalidPreviewRequestError"
)<{
  readonly cause: unknown;
  readonly message: string;
  readonly retryable: false;
}> {}

/** Why Review has no executable action; only a failed request may be retried. */
type YieldFlowReviewError =
  | YieldFlowInvalidPreviewError
  | YieldFlowInvalidPreviewRequestError
  | YieldFlowPreviewError;

const isRetryablePreviewError = Predicate.isTagged("YieldFlowPreviewError");

/** The preview request a Review of `intake` sends. */
const getYieldFlowPreviewRequest = (
  intake: YieldPreviewIntake
): ActionPreviewRequest => {
  switch (intake._tag) {
    case "Enter":
      return { command: intake.request, intent: "enter" };
    case "Exit":
      return { command: intake.request, intent: "exit" };
    case "Manage":
      return { command: intake.request, intent: "manage" };
  }
};

/** A fresh preview of `request` without the transactions the API already skipped. */
const previewYieldFlowRequest = Effect.fn("previewYieldFlowRequest")(function* (
  request: ActionPreviewRequest
): Effect.fn.Return<YieldAction, YieldFlowReviewError, YieldOperations> {
  const yieldOperations = yield* YieldOperations;
  const action = yield* yieldOperations.previewAction(request).pipe(
    Effect.mapError((cause) =>
      cause._tag === "InputValidationError"
        ? new YieldFlowInvalidPreviewRequestError({
            cause,
            message:
              "Yield Transaction Flow Action preview request is invalid.",
            retryable: false,
          })
        : new YieldFlowPreviewError({
            cause,
            message: "Yield Transaction Flow Action preview failed.",
            retryable: true,
          })
    )
  );
  const validation = getValidStakeSessionTx(action);
  if (Result.isFailure(validation)) {
    return yield* new YieldFlowInvalidPreviewError({
      cause: validation.failure,
      message: "Yield Transaction Flow Action preview is not executable.",
      retryable: false,
    });
  }
  return validation.success;
});

/**
 * A confidential vault's action, its amount encrypted or decrypted without
 * asking the wallet anything, so Review shows its gas and Steps runs it. Null
 * when it cannot be created now: Steps then prepares it itself, so Confirm
 * stays possible.
 */
const prepareYieldFlowConfidentialAction = Effect.fn(
  "prepareYieldFlowConfidentialAction"
)(
  function* (preparation: ConfidentialPreparation) {
    const zama = yield* ZamaService;
    const request = yield* prepareConfidentialCommand(zama, preparation);
    return yield* previewYieldFlowRequest(request);
  },
  (effect) =>
    effect.pipe(
      Effect.catch((cause) =>
        Effect.logWarning(
          "Review could not prepare the confidential action."
        ).pipe(Effect.annotateLogs({ cause }), Effect.as(null))
      )
    )
);

/**
 * The executable action Review shows: the continued action itself, a fresh
 * preview, or a confidential vault's action prepared ahead of Steps.
 */
export const previewYieldFlowAction = Effect.fn("previewYieldFlowAction")(
  function* (
    intake: YieldTransactionFlowIntake
  ): Effect.fn.Return<
    YieldAction | null,
    YieldFlowReviewError,
    YieldOperations | ZamaService
  > {
    if (intake._tag === "YieldActionContinuation") return intake.action;
    const preparation = getYieldFlowConfidentialPreparation(intake);
    if (preparation) {
      return yield* prepareYieldFlowConfidentialAction(preparation);
    }
    return yield* previewYieldFlowRequest(getYieldFlowPreviewRequest(intake));
  }
);

type HandOffOutcome =
  | Readonly<{ readonly _tag: "Confirmed" }>
  | Readonly<{ readonly _tag: "RejectedConfirmed" }>;

/**
 * Hands what Review confirmed to the Execution that Steps opens, once: while
 * the Session holds a handoff, another confirmation is rejected. Steps learns
 * which handoff from its navigation state.
 */
export const handOffYieldFlowSource = Effect.fn("handOffYieldFlowSource")(
  function* (
    session: YieldFlowSession,
    source: YieldFlowExecutionSource
  ): Effect.fn.Return<
    HandOffOutcome,
    WidgetNavigationError,
    TrackingService | WidgetNavigation
  > {
    const { destination, handoff, intake } = session;
    const navigation = yield* WidgetNavigation;
    const tracking = yield* TrackingService;
    const trackConfirmation =
      intake._tag === "Exit"
        ? tracking.trackEvent("unstakeClicked", {
            yieldId: intake.integration.id,
            ...(intake.request.arguments?.amount
              ? { amount: intake.request.arguments.amount }
              : {}),
          })
        : Effect.void;

    const next = new YieldFlowHandoff(source);
    return yield* Effect.uninterruptible(
      Effect.gen(function* () {
        const held = yield* Ref.getAndUpdate(
          handoff,
          (current) => current ?? ({ _tag: "Waiting", handoff: next } as const)
        );
        if (held) return { _tag: "RejectedConfirmed" } as const;
        yield* Effect.all(
          [
            // A Steps that never opened cannot start it; confirming again must.
            navigation
              .execute({
                _tag: "Push",
                to: destination.steps({
                  executionHandoff: next,
                  yieldFlowSession: session,
                }),
              })
              .pipe(
                Effect.tapError(() =>
                  Ref.update(handoff, (current) =>
                    current?.handoff === next && current._tag === "Waiting"
                      ? null
                      : current
                  )
                )
              ),
            trackConfirmation,
          ],
          { concurrency: "unbounded", discard: true }
        );
        return { _tag: "Confirmed" } as const;
      })
    );
  }
);

/**
 * What Review estimates the flow's transactions cost in the gas token: the
 * action's, plus the conversion before it. Null when any part is unknown, so
 * Review never shows a partial total.
 */
const getGasAmount = (
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

type ConfirmDecision =
  | Readonly<{
      readonly _tag: "Prepare";
      readonly preparation: ConfidentialPreparation;
      readonly prepared: YieldAction | null;
    }>
  | Readonly<{
      readonly _tag: "HandOff";
      readonly source: YieldFlowExecutionSource;
    }>
  | Readonly<{ readonly _tag: "RetryPreview" }>
  | Readonly<{ readonly _tag: "RejectedBlocked" }>
  | Readonly<{ readonly _tag: "RejectedExpired" }>
  | Readonly<{ readonly _tag: "RejectedNotReady" }>
  | Readonly<{ readonly _tag: "RejectedPreview" }>;

/**
 * What Confirm does with what Review shows right now. A continuation's expiry
 * covers its status: only a waiting action can continue. A confidential
 * vault's action Review could not prepare is prepared on Steps instead.
 */
const decideConfirm = <E>({
  activityExpired,
  kycBlocking,
  preparation,
  preview,
}: {
  readonly activityExpired: boolean;
  readonly kycBlocking: boolean;
  readonly preparation: ConfidentialPreparation | null;
  readonly preview: AsyncResult.AsyncResult<YieldAction | null, E>;
}): ConfirmDecision => {
  if (kycBlocking) return { _tag: "RejectedBlocked" };
  if (activityExpired) return { _tag: "RejectedExpired" };
  if (AsyncResult.isInitial(preview) || preview.waiting) {
    return { _tag: "RejectedNotReady" };
  }
  if (preparation) {
    return {
      _tag: "Prepare",
      preparation,
      prepared: Option.getOrNull(AsyncResult.value(preview)),
    };
  }
  if (AsyncResult.isFailure(preview)) {
    return AsyncResult.error(preview).pipe(
      Option.exists(isRetryablePreviewError)
    )
      ? { _tag: "RetryPreview" }
      : { _tag: "RejectedPreview" };
  }
  return preview.value
    ? { _tag: "HandOff", source: { _tag: "Action", action: preview.value } }
    : { _tag: "RejectedPreview" };
};

/**
 * The approve and wrap a confidential deposit of the underlying token needs,
 * planned when the user confirms so Steps lists them at once. Once the wrap
 * was sent it spent what the approvals set, so what was sent is resumed
 * without reading the allowance again.
 */
const planYieldFlowConversion = Effect.fn("planYieldFlowConversion")(function* (
  session: YieldFlowSession,
  preparation: ConfidentialPreparation
) {
  if (preparation._tag !== "Encrypt" || !preparation.conversion) return [];
  const sent = [...(yield* Ref.get(session.ledger)).values()].map(
    ({ transaction }) => transaction
  );
  if (sent.some(({ type }) => type === "WRAP")) return sent;
  const zama = yield* ZamaService;
  return yield* zama.planConversion({
    amount: preparation.amount,
    conversion: preparation.conversion,
    network: preparation.yieldDto.network,
    owner: preparation.command.address,
  });
});

/**
 * What the transactions around a confidential action cost, in the gas token:
 * the approve and wrap a deposit of the underlying token needs; what the
 * Session already sent costs nothing more. Null when it cannot be estimated,
 * as for an instant exit, whose finishing withdrawal only exists once its
 * unwrap confirms, or when the gas token is not the chain's native one the
 * node prices fees in.
 */
const estimateYieldFlowConversionGas = Effect.fn(
  "estimateYieldFlowConversionGas"
)(
  function* (
    session: YieldFlowSession,
    preparation: ConfidentialPreparation,
    gasFeeToken: Token
  ) {
    if (preparation._tag === "Encrypt" && preparation.instant) return null;
    if (preparation._tag !== "Encrypt" || !preparation.conversion) {
      return exactZero();
    }
    const sent = yield* Ref.get(session.ledger);
    const pending = (yield* planYieldFlowConversion(
      session,
      preparation
    )).filter(({ id }) => !sent.has(id));
    if (pending.length === 0) return exactZero();
    if (gasFeeToken.address !== undefined) return null;
    const evmRpc = yield* EvmRpc;
    const fee = yield* evmRpc.estimateFee({
      chainId: preparation.conversion.chainId,
      from: preparation.command.address,
      transactions: pending.map((transaction, position) => ({
        data: transaction.data,
        fallbackGas: getDirectTransactionFallbackGas(transaction, position),
        to: transaction.to,
      })),
    });
    return exactDecimal(fee.toString()).shiftedBy(-gasFeeToken.decimals);
  },
  (effect) =>
    effect.pipe(
      Effect.catch((cause) =>
        Effect.logWarning("Review could not estimate the conversion gas.").pipe(
          Effect.annotateLogs({ cause }),
          Effect.as(null)
        )
      )
    )
);

/**
 * The Planned Steps Steps lists until the prepared action returns them. A
 * private exit's operator grants are read when the user confirms, as the API
 * reads them when it builds the action.
 */
const readYieldFlowPlannedSteps = Effect.fn("readYieldFlowPlannedSteps")(
  function* (
    intake: YieldTransactionFlowIntake,
    preparation: ConfidentialPreparation
  ) {
    const operators =
      preparation._tag === "Encrypt" &&
      preparation.intent === "exit" &&
      !preparation.instant
        ? getConfidentialRedeemOperators(preparation.yieldDto)
        : null;
    const missingOperatorGrants = operators
      ? yield* ZamaService.use((zama) =>
          zama.countMissingOperatorGrants({
            ...operators,
            owner: preparation.command.address,
          })
        )
      : 0;
    return getYieldFlowPlannedStepTypes(intake, {
      missingOperatorGrants,
    });
  }
);

/**
 * What Steps runs for a confidential vault, planned when the user confirms
 * so Steps lists every step at once, with the action Review prepared.
 */
const planYieldFlowPreparation = Effect.fn("planYieldFlowPreparation")(
  function* (
    session: YieldFlowSession,
    preparation: ConfidentialPreparation,
    prepared: YieldAction | null
  ) {
    return {
      _tag: "Prepare",
      conversion: yield* planYieldFlowConversion(session, preparation),
      preparation,
      prepared,
      plannedStepTypes: yield* readYieldFlowPlannedSteps(
        session.intake,
        preparation
      ),
    } satisfies YieldFlowExecutionSource;
  }
);

/** One arrival at a Session's Review: its history entry's key. */
export class YieldFlowReviewVisit extends Data.Class<{
  readonly session: YieldFlowSession;
  readonly visit: string;
}> {}

/**
 * Review's preview, view, and confirmation for one visit. Every render of a
 * visit, even one React discards, gets the same Atoms; arriving again previews
 * a fresh action, and leaving interrupts an in-flight preview.
 *
 * Arriving also releases an action still waiting for a Steps that never
 * started it, so confirming again hands off a new one. An action already
 * running stays held until its Execution ends.
 *
 * The model lives in an Atom: a family holds its values only weakly, so the
 * subscribed Atom is what keeps the model alive.
 */
export const yieldFlowReviewPage = Atom.family(
  ({ session }: YieldFlowReviewVisit) => {
    const page = makeYieldFlowReviewPage(session);
    const arrivalAtom = Atom.make(
      Ref.update(session.handoff, (current) =>
        current?._tag === "Waiting" ? null : current
      )
    );
    return Atom.make((get) => {
      get(arrivalAtom);
      return page;
    }).pipe(Atom.withLabel("yieldFlowReviewPage"));
  }
);

export const makeYieldFlowReviewPage = (session: YieldFlowSession) => {
  const { intake } = session;
  const kycGateKey = new CurrentYieldKycGateKey({
    enabled: true,
    yieldDto: getYieldTransactionFlowKycYield(intake),
  });
  const kycGateAtom = currentYieldKycGateAtom(kycGateKey);
  const kycBlockingAtom = Atom.make((get) => get(kycGateAtom).isBlocking).pipe(
    Atom.withLabel("yieldFlowReviewKycBlocking")
  );
  const activityExpiredAtom = Atom.make((get) => {
    if (intake._tag !== "YieldActionContinuation") return false;
    const presentationTime = get(presentationClockAtom);
    return (
      presentationTime === null ||
      !isContinuableYieldAction(intake.action, presentationTime.now)
    );
  }).pipe(Atom.withLabel("yieldFlowReviewActivityExpired"));

  // Requested once KYC lets the user act on it, and again on retry.
  const previewAtom = walletRuntime
    .atom((get) =>
      get(kycBlockingAtom)
        ? Effect.succeed(null)
        : previewYieldFlowAction(intake)
    )
    .pipe(Atom.withLabel("yieldFlowReviewPreview"));

  const pricingInput = getYieldTransactionFlowReviewPricingInput(intake);
  const pricesKey = new PricesKey({
    request: pricingInput
      ? getTokensPricesRequest({
          token: pricingInput.token,
          yieldDto: pricingInput.yield,
        })
      : null,
  });
  const gasWarningInput = getYieldTransactionFlowGasWarningInput(intake);
  const { additionalAddresses, address } = gasWarningInput.walletScope;
  const gasBalancesKey = new GasTokenBalancesKey({
    command: {
      addresses: [
        {
          address,
          ...(additionalAddresses ? { additionalAddresses } : {}),
          network: gasWarningInput.gasFeeToken.network,
          ...(gasWarningInput.gasFeeToken.address
            ? { tokenAddress: gasWarningInput.gasFeeToken.address }
            : {}),
        },
      ],
    },
  });

  const preparation = getYieldFlowConfidentialPreparation(intake);
  // A deposit of the underlying token also pays for its approve and wrap;
  // anything else converts nothing.
  const conversionGasAtom = walletRuntime
    .atom((get) => {
      if (!preparation) return Effect.succeed(exactZero());
      return get(kycBlockingAtom)
        ? Effect.succeed(null)
        : estimateYieldFlowConversionGas(
            session,
            preparation,
            gasWarningInput.gasFeeToken
          );
    })
    .pipe(Atom.withLabel("yieldFlowReviewConversionGas"));

  const baseViewAtom = Atom.make((get) => {
    const preview = get(previewAtom);
    const kyc = get(kycGateAtom);
    const action = Option.getOrNull(AsyncResult.value(preview));
    const previewError = Option.getOrNull(AsyncResult.error(preview));
    const actionPreviewLoading =
      AsyncResult.isInitial(preview) || preview.waiting;
    const conversionGas = get(conversionGasAtom);
    const conversionGasLoading =
      AsyncResult.isInitial(conversionGas) || conversionGas.waiting;
    const gasAmount = getGasAmount(
      action,
      AsyncResult.getOrElse(conversionGas, () => null)
    );
    const gasWarning = gasAmount
      ? get(gasTokenBalancesResourceAtom.foreground(gasBalancesKey)).pipe(
          AsyncResult.map((balances) =>
            checkGasAmount({
              gasEstimate: gasAmount,
              gasTokenBalance: balances[0],
              ...(gasWarningInput.stakeAmount && gasWarningInput.stakeToken
                ? {
                    isStake: true as const,
                    stakeAmount: gasWarningInput.stakeAmount,
                    stakeToken: gasWarningInput.stakeToken,
                  }
                : { isStake: false as const }),
            })
          )
        )
      : AsyncResult.success(null);

    return {
      action,
      actionPreviewLoading,
      confirmDisabled:
        kyc.isBlocking ||
        (previewError !== null && !isRetryablePreviewError(previewError)),
      confirmLoading: actionPreviewLoading || kyc.isLoading,
      gasAmount,
      gasCheckLoading:
        actionPreviewLoading ||
        conversionGasLoading ||
        toPresentable(gasWarning)._tag === "Loading",
      isGasCheckWarning: gasWarning.pipe(
        AsyncResult.value,
        Option.match({ onNone: () => false, onSome: Boolean })
      ),
      kyc,
      prices: AsyncResult.getOrElse(
        get(pricesAtom.foreground(pricesKey)),
        () => null
      ),
    } as const;
  }).pipe(Atom.withLabel("yieldFlowReviewBaseView"));

  const stakeViewAtom =
    intake._tag === "Enter"
      ? makeYieldFlowStakeReviewViewAtom(intake, baseViewAtom)
      : null;

  return {
    activityReviewViewAtom: Atom.make((get) => {
      const view = get(baseViewAtom);
      return {
        confirmDisabled: view.confirmDisabled || get(activityExpiredAtom),
        confirmLoading: view.confirmLoading,
      } as const;
    }).pipe(Atom.withLabel("yieldFlowActivityReviewView")),
    confirmAtom: walletRuntime
      .fn(
        (_input: undefined, get) =>
          Effect.gen(function* () {
            const decision = decideConfirm({
              activityExpired: get(activityExpiredAtom),
              kycBlocking: get(kycBlockingAtom),
              preparation,
              preview: get(previewAtom),
            });
            if (decision._tag === "Prepare") {
              return yield* handOffYieldFlowSource(
                session,
                yield* planYieldFlowPreparation(
                  session,
                  decision.preparation,
                  decision.prepared
                )
              );
            }
            if (decision._tag === "HandOff") {
              return yield* handOffYieldFlowSource(session, decision.source);
            }
            if (decision._tag === "RetryPreview") {
              get.refresh(previewAtom);
              return { _tag: "RetriedPreview" } as const;
            }
            return decision;
          }),
        { initialValue: undefined }
      )
      .pipe(Atom.withLabel("confirmYieldFlowReview")),
    refreshKycAtom: Atom.fnSync(
      (_input: undefined, get) => {
        get.set(refreshCurrentYieldKycAtom(kycGateKey), undefined);
      },
      { initialValue: undefined }
    ).pipe(Atom.withLabel("refreshYieldFlowReviewKyc")),
    reviewViewAtom: Atom.make((get) => ({
      ...get(baseViewAtom),
      stake: stakeViewAtom ? get(stakeViewAtom) : null,
    })).pipe(Atom.withLabel("yieldFlowReviewView")),
  } as const;
};
