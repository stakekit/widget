import { Data, Effect, Option, Predicate, Ref, Result } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { walletRuntime } from "../../../app/runtime/wallet-runtime";
import type { YieldAction } from "../../../domain/action/models";
import {
  getTransactionGasEstimate,
  getValidStakeSessionTx,
} from "../../../domain/action/rules";
import { isContinuableYieldAction } from "../../../domain/activity/action-capabilities";
import { getConfidentialRedeemOperators } from "../../../domain/earn/confidential";
import { exactZero } from "../../../domain/finance/exact";
import { checkGasAmount } from "../../../domain/finance/gas";
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
import {
  WidgetNavigation,
  type WidgetNavigationError,
} from "../../../services/navigation/widget-navigation";
import { TrackingService } from "../../../services/tracking/tracking-service";
import {
  type ConfidentialPreparation,
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
  type ClassicFlowExecutionSource,
  ClassicFlowHandoff,
  type ClassicFlowSession,
  type ClassicTransactionFlowIntake,
  getClassicFlowConfidentialPreparation,
  getClassicFlowPlannedStepTypes,
  getClassicTransactionFlowGasWarningInput,
  getClassicTransactionFlowKycYield,
  getClassicTransactionFlowReviewPricingInput,
  makeClassicFlowNavigationState,
} from "../model/classic-transaction-flow";
import { makeClassicFlowStakeReviewViewAtom } from "./yield-summary";

class ClassicFlowPreviewError extends Data.TaggedError(
  "ClassicFlowPreviewError"
)<{
  readonly cause: unknown;
  readonly message: string;
  readonly retryable: true;
}> {}

class ClassicFlowInvalidPreviewError extends Data.TaggedError(
  "ClassicFlowInvalidPreviewError"
)<{
  readonly cause: unknown;
  readonly message: string;
  readonly retryable: false;
}> {}

class ClassicFlowInvalidPreviewRequestError extends Data.TaggedError(
  "ClassicFlowInvalidPreviewRequestError"
)<{
  readonly cause: unknown;
  readonly message: string;
  readonly retryable: false;
}> {}

/** Why Review has no executable action; only a failed request may be retried. */
type ClassicFlowReviewError =
  | ClassicFlowInvalidPreviewError
  | ClassicFlowInvalidPreviewRequestError
  | ClassicFlowPreviewError;

const isRetryablePreviewError = Predicate.isTagged("ClassicFlowPreviewError");

/** The preview request a Review of `intake` sends. */
const getClassicFlowPreviewRequest = (
  intake: Exclude<
    ClassicTransactionFlowIntake,
    { readonly _tag: "YieldActionContinuation" }
  >
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

/**
 * The executable action Review shows: the continued action itself, or a fresh
 * preview without the transactions the API already skipped. A confidential
 * vault's action exists only once Steps encrypts or decrypts its amount.
 */
export const previewClassicFlowAction = Effect.fn("previewClassicFlowAction")(
  function* (
    intake: ClassicTransactionFlowIntake
  ): Effect.fn.Return<
    YieldAction | null,
    ClassicFlowReviewError,
    YieldOperations
  > {
    if (intake._tag === "YieldActionContinuation") return intake.action;
    if (getClassicFlowConfidentialPreparation(intake)) return null;
    const yieldOperations = yield* YieldOperations;
    const action = yield* yieldOperations
      .previewAction(getClassicFlowPreviewRequest(intake))
      .pipe(
        Effect.mapError((cause) =>
          cause._tag === "InputValidationError"
            ? new ClassicFlowInvalidPreviewRequestError({
                cause,
                message:
                  "Classic Transaction Flow Action preview request is invalid.",
                retryable: false,
              })
            : new ClassicFlowPreviewError({
                cause,
                message: "Classic Transaction Flow Action preview failed.",
                retryable: true,
              })
        )
      );
    const validation = getValidStakeSessionTx(action);
    if (Result.isFailure(validation)) {
      return yield* new ClassicFlowInvalidPreviewError({
        cause: validation.failure,
        message: "Classic Transaction Flow Action preview is not executable.",
        retryable: false,
      });
    }
    return validation.success;
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
export const handOffClassicFlowSource = Effect.fn("handOffClassicFlowSource")(
  function* (
    session: ClassicFlowSession,
    source: ClassicFlowExecutionSource
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

    const next = new ClassicFlowHandoff(source);
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
                path: destination.stepsPath,
                state: makeClassicFlowNavigationState(session, next),
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

const getGasAmount = (action: YieldAction | null) => {
  if (!action) return null;

  const total = action.transactions.reduce((sum, transaction) => {
    const decoded = getTransactionGasEstimate(transaction);
    return sum.plus(decoded?.amount ?? 0);
  }, exactZero());

  return total.isZero() ? null : total;
};

type ConfirmDecision =
  | Readonly<{
      readonly _tag: "Prepare";
      readonly preparation: ConfidentialPreparation;
    }>
  | Readonly<{
      readonly _tag: "HandOff";
      readonly source: ClassicFlowExecutionSource;
    }>
  | Readonly<{ readonly _tag: "RetryPreview" }>
  | Readonly<{ readonly _tag: "RejectedBlocked" }>
  | Readonly<{ readonly _tag: "RejectedExpired" }>
  | Readonly<{ readonly _tag: "RejectedNotReady" }>
  | Readonly<{ readonly _tag: "RejectedPreview" }>;

/**
 * What Confirm does with what Review shows right now. A continuation's expiry
 * covers its status: only a waiting action can continue. A confidential
 * vault's action is prepared on Steps, so it needs no preview.
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
  if (preparation) return { _tag: "Prepare", preparation };
  if (AsyncResult.isInitial(preview) || preview.waiting) {
    return { _tag: "RejectedNotReady" };
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
const planClassicFlowConversion = Effect.fn("planClassicFlowConversion")(
  function* (
    session: ClassicFlowSession,
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
  }
);

/**
 * The Planned Steps Steps lists until the prepared action returns them. A
 * private exit's operator grants are read when the user confirms, as the API
 * reads them when it builds the action.
 */
const readClassicFlowPlannedSteps = Effect.fn("readClassicFlowPlannedSteps")(
  function* (
    intake: ClassicTransactionFlowIntake,
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
    return getClassicFlowPlannedStepTypes(intake, {
      missingOperatorGrants,
    });
  }
);

/**
 * What Steps runs for a confidential vault, planned when the user confirms
 * so Steps lists every step at once.
 */
const planClassicFlowPreparation = Effect.fn("planClassicFlowPreparation")(
  function* (
    session: ClassicFlowSession,
    preparation: ConfidentialPreparation
  ) {
    return {
      _tag: "Prepare",
      conversion: yield* planClassicFlowConversion(session, preparation),
      preparation,
      plannedStepTypes: yield* readClassicFlowPlannedSteps(
        session.intake,
        preparation
      ),
    } satisfies ClassicFlowExecutionSource;
  }
);

/** One arrival at a Session's Review: its history entry's key. */
export class ClassicFlowReviewVisit extends Data.Class<{
  readonly session: ClassicFlowSession;
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
export const classicFlowReviewPage = Atom.family(
  ({ session }: ClassicFlowReviewVisit) => {
    const page = makeClassicFlowReviewPage(session);
    const arrivalAtom = Atom.make(
      Ref.update(session.handoff, (current) =>
        current?._tag === "Waiting" ? null : current
      )
    );
    return Atom.make((get) => {
      get(arrivalAtom);
      return page;
    }).pipe(Atom.withLabel("classicFlowReviewPage"));
  }
);

export const makeClassicFlowReviewPage = (session: ClassicFlowSession) => {
  const { intake } = session;
  const kycGateKey = new CurrentYieldKycGateKey({
    enabled: true,
    yieldDto: getClassicTransactionFlowKycYield(intake),
  });
  const kycGateAtom = currentYieldKycGateAtom(kycGateKey);
  const kycBlockingAtom = Atom.make((get) => get(kycGateAtom).isBlocking).pipe(
    Atom.withLabel("classicFlowReviewKycBlocking")
  );
  const activityExpiredAtom = Atom.make((get) => {
    if (intake._tag !== "YieldActionContinuation") return false;
    const presentationTime = get(presentationClockAtom);
    return (
      presentationTime === null ||
      !isContinuableYieldAction(intake.action, presentationTime.now)
    );
  }).pipe(Atom.withLabel("classicFlowReviewActivityExpired"));

  // Requested once KYC lets the user act on it, and again on retry.
  const previewAtom = walletRuntime
    .atom((get) =>
      get(kycBlockingAtom)
        ? Effect.succeed(null)
        : previewClassicFlowAction(intake)
    )
    .pipe(Atom.withLabel("classicFlowReviewPreview"));

  const pricingInput = getClassicTransactionFlowReviewPricingInput(intake);
  const pricesKey = new PricesKey({
    request: pricingInput
      ? getTokensPricesRequest({
          token: pricingInput.token,
          yieldDto: pricingInput.yield,
        })
      : null,
  });
  const gasWarningInput = getClassicTransactionFlowGasWarningInput(intake);
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

  const baseViewAtom = Atom.make((get) => {
    const preview = get(previewAtom);
    const kyc = get(kycGateAtom);
    const action = Option.getOrNull(AsyncResult.value(preview));
    const previewError = Option.getOrNull(AsyncResult.error(preview));
    const actionPreviewLoading =
      AsyncResult.isInitial(preview) || preview.waiting;
    const gasAmount = getGasAmount(action);
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
        actionPreviewLoading || toPresentable(gasWarning)._tag === "Loading",
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
  }).pipe(Atom.withLabel("classicFlowReviewBaseView"));

  const stakeViewAtom =
    intake._tag === "Enter"
      ? makeClassicFlowStakeReviewViewAtom(intake, baseViewAtom)
      : null;

  return {
    activityReviewViewAtom: Atom.make((get) => {
      const view = get(baseViewAtom);
      return {
        confirmDisabled: view.confirmDisabled || get(activityExpiredAtom),
        confirmLoading: view.confirmLoading,
      } as const;
    }).pipe(Atom.withLabel("classicFlowActivityReviewView")),
    confirmAtom: walletRuntime
      .fn(
        (_input: undefined, get) =>
          Effect.gen(function* () {
            const decision = decideConfirm({
              activityExpired: get(activityExpiredAtom),
              kycBlocking: get(kycBlockingAtom),
              preparation: getClassicFlowConfidentialPreparation(intake),
              preview: get(previewAtom),
            });
            if (decision._tag === "Prepare") {
              return yield* handOffClassicFlowSource(
                session,
                yield* planClassicFlowPreparation(session, decision.preparation)
              );
            }
            if (decision._tag === "HandOff") {
              return yield* handOffClassicFlowSource(session, decision.source);
            }
            if (decision._tag === "RetryPreview") {
              get.refresh(previewAtom);
              return { _tag: "RetriedPreview" } as const;
            }
            return decision;
          }),
        { initialValue: undefined }
      )
      .pipe(Atom.withLabel("confirmClassicFlowReview")),
    refreshKycAtom: Atom.fnSync(
      (_input: undefined, get) => {
        get.set(refreshCurrentYieldKycAtom(kycGateKey), undefined);
      },
      { initialValue: undefined }
    ).pipe(Atom.withLabel("refreshClassicFlowReviewKyc")),
    reviewViewAtom: Atom.make((get) => ({
      ...get(baseViewAtom),
      stake: stakeViewAtom ? get(stakeViewAtom) : null,
    })).pipe(Atom.withLabel("classicFlowReviewView")),
  } as const;
};
