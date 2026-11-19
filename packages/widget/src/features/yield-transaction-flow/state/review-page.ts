import { Data, Effect, Option, Predicate, Result } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";

import { getValidStakeSessionTx } from "../../../domain/action/rules";
import { isContinuableYieldAction } from "../../../domain/activity/action-capabilities";
import type { YieldAction } from "../../../domain/earn/action-models";
import { exactZero } from "../../../domain/finance/exact";
import { checkGasAmount } from "../../../domain/finance/gas";
import {
  gasTokenBalancesResourceAtom,
  walletScopeGasTokenBalancesKey,
} from "../../../resources/gas-token-balances/gas-token-balances";
import { optionalTokenPricesAtom } from "../../../resources/token-prices/token-prices";
import { walletRuntime } from "../../../runtime/wallet-runtime";
import {
  type ActionPreviewRequest,
  YieldOperations,
} from "../../../services/api/operations";
import {
  WidgetNavigation,
  type WidgetNavigationError,
} from "../../../services/navigation/widget-navigation";
import { TrackingService } from "../../../services/tracking/tracking-service";
import type { ZamaService } from "../../../services/zama/zama-service";
import { toPresentable } from "../../../shared/effect/async-result";
import { presentationClockAtom } from "../../../shared/effect/presentation-clock";
import {
  handOffTransactionFlow,
  makeTransactionFlowReviewPage,
  type TransactionFlowHandoffOutcome,
} from "../../transaction-flow/index";
import {
  CurrentYieldKycGateKey,
  currentYieldKycGateAtom,
  refreshCurrentYieldKycAtom,
} from "../../yield-summary/index";
import {
  getYieldTransactionFlowKycYield,
  type YieldPreviewIntake,
  type YieldTransactionFlowIntake,
} from "../model/intake";
import {
  getYieldFlowGasAmount,
  getYieldTransactionFlowGasWarningInput,
} from "../model/pricing";
import {
  type YieldFlowExecutionSource,
  YieldFlowHandoff,
  type YieldFlowSession,
} from "../model/session";
import { getYieldFlowTransactionsToSign } from "../model/yield-transaction-workflow";
import { getYieldFlowConfidentialReview } from "./confidential-plan";
import { getYieldFlowReviewPricesKey } from "./review-prices";
import {
  getYieldFlowWithdrawalFee,
  makeYieldFlowStakeReviewViewAtom,
} from "./yield-summary";

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
    const confidential = getYieldFlowConfidentialReview(intake);
    if (confidential) {
      return yield* confidential.prepareAction(previewYieldFlowRequest);
    }
    return yield* previewYieldFlowRequest(getYieldFlowPreviewRequest(intake));
  }
);

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
    TransactionFlowHandoffOutcome,
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
    return yield* handOffTransactionFlow(
      handoff,
      { _tag: "Waiting", handoff: next },
      Effect.all(
        [
          navigation.execute({
            _tag: "Push",
            to: destination.steps({
              executionHandoff: next,
              yieldFlowSession: session,
            }),
          }),
          trackConfirmation,
        ],
        { concurrency: "unbounded", discard: true }
      )
    );
  }
);

type ConfirmDecision<Confidential> =
  | Readonly<{
      readonly _tag: "PlanConfidentialHandoff";
      readonly confidential: Confidential;
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
const decideConfirm = <Confidential, E>({
  activityExpired,
  confidential,
  kycBlocking,
  preview,
}: {
  readonly activityExpired: boolean;
  /** A confidential vault's Review; null for any other. */
  readonly confidential: Confidential | null;
  readonly kycBlocking: boolean;
  readonly preview: AsyncResult.AsyncResult<YieldAction | null, E>;
}): ConfirmDecision<Confidential> => {
  if (kycBlocking) return { _tag: "RejectedBlocked" };
  if (activityExpired) return { _tag: "RejectedExpired" };
  if (AsyncResult.isInitial(preview) || preview.waiting) {
    return { _tag: "RejectedNotReady" };
  }
  if (confidential !== null) {
    return {
      _tag: "PlanConfidentialHandoff",
      confidential,
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
 * Arriving also releases a Handoff still waiting for a Steps that never
 * started it; see `makeTransactionFlowReviewPage`.
 */
export const yieldFlowReviewPage = Atom.family(
  ({ session }: YieldFlowReviewVisit) =>
    makeTransactionFlowReviewPage(
      session.handoff,
      makeYieldFlowReviewPage(session)
    ).pipe(Atom.withLabel("yieldFlowReviewPage"))
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

  const pricesKey = getYieldFlowReviewPricesKey(intake);
  const gasWarningInput = getYieldTransactionFlowGasWarningInput(intake);
  const gasBalancesKey = walletScopeGasTokenBalancesKey(
    gasWarningInput.walletScope,
    gasWarningInput.gasFeeToken
  );

  const confidential = getYieldFlowConfidentialReview(intake);
  // A deposit of the underlying token also signs and pays for its approve
  // and wrap; anything else converts nothing.
  const conversionAtom = walletRuntime
    .atom((get) =>
      !confidential || get(kycBlockingAtom)
        ? Effect.succeed([])
        : confidential.planPendingConversion(session)
    )
    .pipe(Atom.withLabel("yieldFlowReviewConversion"));
  const conversionGasAtom = walletRuntime
    .atom((get) => {
      if (!confidential) return Effect.succeed(exactZero());
      return get(kycBlockingAtom)
        ? Effect.succeed(null)
        : get
            .result(conversionAtom)
            .pipe(
              Effect.flatMap((pending) =>
                confidential.estimateConversionGas(
                  pending,
                  gasWarningInput.gasFeeToken
                )
              )
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
    const conversion = get(conversionAtom);
    const conversionLoading =
      AsyncResult.isInitial(conversion) || conversion.waiting;
    const conversionGas = get(conversionGasAtom);
    const conversionGasLoading =
      AsyncResult.isInitial(conversionGas) || conversionGas.waiting;
    const gasAmount = getYieldFlowGasAmount(
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
      /** What the wallet still signs, in order; null until it is known. */
      transactionsToSign:
        action && !conversionLoading
          ? getYieldFlowTransactionsToSign(
              action,
              AsyncResult.getOrElse(conversion, () => [])
            )
          : null,
      transactionsToSignLoading: actionPreviewLoading || conversionLoading,
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
        get(optionalTokenPricesAtom.foreground(pricesKey)),
        () => null
      ),
    } as const;
  }).pipe(Atom.withLabel("yieldFlowReviewBaseView"));

  const page = {
    /** Whether Confirm can be pressed, and whether it is still settling. */
    confirmViewAtom: Atom.make((get) => {
      const view = get(baseViewAtom);
      return {
        confirmDisabled: view.confirmDisabled || get(activityExpiredAtom),
        confirmLoading: view.confirmLoading,
      } as const;
    }).pipe(Atom.withLabel("yieldFlowReviewConfirmView")),
    confirmAtom: walletRuntime
      .fn(
        (_input: undefined, get) =>
          Effect.gen(function* () {
            const decision = decideConfirm({
              activityExpired: get(activityExpiredAtom),
              confidential,
              kycBlocking: get(kycBlockingAtom),
              preview: get(previewAtom),
            });
            if (decision._tag === "PlanConfidentialHandoff") {
              const source = yield* decision.confidential.planHandoff(
                session,
                decision.prepared
              );
              return yield* handOffYieldFlowSource(session, source);
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
    /** The preview, gas check, KYC and prices every Review shows. */
    reviewViewAtom: baseViewAtom,
  } as const;

  switch (intake._tag) {
    case "Enter":
      return {
        ...page,
        _tag: intake._tag,
        intake,
        /** The deposit's amount, rewards and fees. */
        stakeViewAtom: makeYieldFlowStakeReviewViewAtom(intake, baseViewAtom),
      } as const;
    case "Exit":
      return {
        ...page,
        _tag: intake._tag,
        intake,
        /** The exit's withdrawal fee; null without one. */
        withdrawalFee: getYieldFlowWithdrawalFee(intake),
      } as const;
    case "Manage":
      return { ...page, _tag: intake._tag, intake } as const;
    case "YieldActionContinuation":
      return { ...page, _tag: intake._tag, intake } as const;
  }
};

type YieldFlowReviewPage = ReturnType<typeof makeYieldFlowReviewPage>;

/** Review of one intake variant: what only that variant's Review reads. */
export type YieldFlowReviewVariant<Tag extends YieldFlowReviewPage["_tag"]> =
  Extract<YieldFlowReviewPage, { readonly _tag: Tag }>;
