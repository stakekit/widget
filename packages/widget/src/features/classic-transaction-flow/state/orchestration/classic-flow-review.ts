import {
  Data,
  Effect,
  PubSub,
  Ref,
  Result,
  type Scope,
  Stream,
  SubscriptionRef,
} from "effect";
import type {
  ActionCommand,
  ManageActionCommand,
  YieldAction,
} from "../../../../domain/action/models";
import {
  ActionStatus,
  getValidStakeSessionTx,
} from "../../../../domain/action/rules";
import {
  getConfidentialChainId,
  planConfidentialEncryption,
  toConfidentialArguments,
} from "../../../../domain/earn/confidential";
import {
  type InputValidationError,
  YieldOperations,
} from "../../../../services/api/operations";
import type { WidgetNavigationError } from "../../../../services/navigation/widget-navigation";
import { TrackingService } from "../../../../services/tracking/tracking-service";
import { WalletService } from "../../../../services/wallet/wallet-service";
import { ZamaService } from "../../../../services/zama/zama-service";
import { makeScopedSerialOperations } from "../../../../shared/effect/scoped-serial-operations";
import {
  type ClassicTransactionFlowIntake,
  getClassicFlowConfidentialInput,
  getClassicFlowDecryptInput,
} from "../../model/classic-transaction-flow";
import {
  type ClassicFlowExecutionSource,
  ClassicFlowPrepareError,
} from "./classic-flow-execution";

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
  readonly cause: InputValidationError;
  readonly message: string;
  readonly retryable: false;
}> {}

type ClassicFlowReviewError =
  | ClassicFlowInvalidPreviewError
  | ClassicFlowInvalidPreviewRequestError
  | ClassicFlowPreviewError;

export type ClassicFlowReviewEligibility = Readonly<{
  readonly activityExpired: boolean;
  readonly kycBlocking: boolean;
}>;

type ClassicFlowReviewPreview =
  | Readonly<{ readonly _tag: "Initial" }>
  | Readonly<{ readonly _tag: "Loading" }>
  | Readonly<{
      readonly _tag: "Success";
      readonly action: YieldAction | null;
    }>
  | Readonly<{
      readonly _tag: "Failure";
      readonly error: ClassicFlowReviewError;
    }>;

type ClassicFlowReviewState = Readonly<{
  readonly preview: ClassicFlowReviewPreview;
}>;

type ClassicFlowReviewOutcome =
  | Readonly<{ readonly _tag: "Confirmed" }>
  | Readonly<{ readonly _tag: "RejectedBlocked" }>
  | Readonly<{ readonly _tag: "RejectedExpired" }>
  | Readonly<{ readonly _tag: "RejectedNotReady" }>
  | Readonly<{ readonly _tag: "RejectedPreview" }>
  | Readonly<{ readonly _tag: "RejectedSession" }>;

export type ClassicFlowReviewHandle = Readonly<{
  readonly confirm: () => Effect.Effect<
    ClassicFlowReviewOutcome,
    ClassicFlowReviewError | WidgetNavigationError
  >;
  readonly states: Stream.Stream<ClassicFlowReviewState>;
}>;

type PromoteToExecution = (
  source: ClassicFlowExecutionSource,
  afterReservation: Effect.Effect<void>,
  eligibility: Effect.Effect<ClassicFlowReviewEligibility>
) => Effect.Effect<
  | Readonly<{ readonly _tag: "Promoted" }>
  | Readonly<{ readonly _tag: "RejectedAlreadyReserved" }>
  | Readonly<{ readonly _tag: "RejectedBlocked" }>
  | Readonly<{ readonly _tag: "RejectedExpired" }>,
  WidgetNavigationError
>;

type ActionPreviewRequest =
  | Readonly<{
      readonly command: ActionCommand;
      readonly intent: "enter" | "exit";
    }>
  | Readonly<{
      readonly command: ManageActionCommand;
      readonly intent: "manage";
    }>;

const getPreviewRequest = (
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

const getInitialReviewPreview = (
  intake: ClassicTransactionFlowIntake
): ClassicFlowReviewPreview => {
  if (intake._tag === "YieldActionContinuation") {
    return { _tag: "Success", action: intake.action };
  }
  // Confidential actions are created on Steps, after encryption.
  if (
    getClassicFlowConfidentialInput(intake) ||
    getClassicFlowDecryptInput(intake)
  ) {
    return { _tag: "Success", action: null };
  }
  return { _tag: "Initial" };
};

export const makeClassicFlowReviewFactory = Effect.fn(
  "makeClassicFlowReviewFactory"
)(function* () {
  const tracking = yield* TrackingService;
  const yieldOperations = yield* YieldOperations;
  const zama = yield* ZamaService;
  const wallet = yield* WalletService;

  return Effect.fn("makeClassicFlowReview")(function* ({
    eligibilityStates,
    intake,
    promoteToExecution,
  }: {
    readonly eligibilityStates: Stream.Stream<ClassicFlowReviewEligibility>;
    readonly intake: ClassicTransactionFlowIntake;
    readonly promoteToExecution: PromoteToExecution;
  }): Effect.fn.Return<ClassicFlowReviewHandle, never, Scope.Scope> {
    const eligibilityRef = yield* Ref.make<ClassicFlowReviewEligibility>({
      activityExpired: true,
      kycBlocking: true,
    });
    const stateRef = yield* SubscriptionRef.make<ClassicFlowReviewState>({
      preview: getInitialReviewPreview(intake),
    });
    yield* Effect.addFinalizer(() => PubSub.shutdown(stateRef.pubsub));
    const operations = yield* makeScopedSerialOperations();
    const confidential = getClassicFlowConfidentialInput(intake);

    const encryptPreviewRequest = Effect.fn("ClassicFlowReview.encrypt")(
      function* (request: ActionPreviewRequest) {
        if (!confidential || request.intent === "manage") return request;
        const value = confidential.conversion
          ? yield* zama.wrappedAmount({
              amount: confidential.amount,
              conversion: confidential.conversion,
            })
          : confidential.amount;
        const plan = planConfidentialEncryption({
          instant: confidential.instant,
          intent: confidential.intent,
          value,
          yieldDto: confidential.yieldDto,
        });
        if (!plan) return request;
        const encryption = yield* zama.encrypt({
          owner: request.command.address,
          plan,
        });
        return {
          ...request,
          command: {
            ...request.command,
            arguments: toConfidentialArguments(
              request.command.arguments ?? {},
              encryption,
              confidential.assetAddress
            ),
          },
        };
      },
      Effect.mapError(
        (cause) =>
          new ClassicFlowPreviewError({
            cause,
            message: "Classic Transaction Flow amount encryption failed.",
            retryable: true,
          })
      )
    );

    const loadPreviewOpen = Effect.gen(function* () {
      if (intake._tag === "YieldActionContinuation") return intake.action;
      yield* SubscriptionRef.set(stateRef, { preview: { _tag: "Loading" } });
      const action = yield* yieldOperations
        .previewAction(getPreviewRequest(intake))
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
    }).pipe(
      Effect.tap((action) =>
        SubscriptionRef.set(stateRef, {
          preview: { _tag: "Success", action },
        })
      ),
      Effect.tapError((error) =>
        SubscriptionRef.set(stateRef, {
          preview: { _tag: "Failure", error },
        })
      )
    );

    yield* eligibilityStates.pipe(
      Stream.runForEach((eligibility) =>
        Ref.set(eligibilityRef, eligibility).pipe(
          Effect.andThen(
            operations
              .run(
                Effect.gen(function* () {
                  const latestEligibility = yield* Ref.get(eligibilityRef);
                  const state = yield* SubscriptionRef.get(stateRef);
                  if (
                    !latestEligibility.kycBlocking &&
                    state.preview._tag === "Initial"
                  ) {
                    yield* loadPreviewOpen.pipe(Effect.ignore);
                  }
                })
              )
              .pipe(Effect.forkScoped)
          ),
          Effect.asVoid
        )
      ),
      Effect.forkScoped({ startImmediately: true })
    );

    const decrypt = getClassicFlowDecryptInput(intake);

    const decryptPreviewRequest = Effect.fn("ClassicFlowReview.decrypt")(
      function* (request: ActionPreviewRequest) {
        if (!decrypt || request.intent !== "manage") return request;
        const { cleartext, decryptionProof } = yield* zama.publicDecrypt({
          chainId: decrypt.chainId,
          owner: decrypt.owner,
          requestId: decrypt.handle,
        });
        return {
          ...request,
          command: {
            ...request.command,
            arguments: {
              ...request.command.arguments,
              decryptedAmount: cleartext.toString(),
              decryptionProof,
            },
          },
        };
      }
    );

    const prepareConfidentialAction = Effect.gen(function* () {
      if (intake._tag === "YieldActionContinuation") {
        return yield* Effect.die("A continuation never prepares an action.");
      }
      // No permit signer: the balance could never be revealed to withdraw.
      if (
        intake._tag === "Enter" &&
        confidential &&
        !(yield* wallet.canSignPermit)
      ) {
        return yield* new ClassicFlowInvalidPreviewError({
          cause: null,
          message: "This wallet cannot reveal confidential balances.",
          retryable: false,
        });
      }
      // The hidden cUSDC balance is checked here, not on the form.
      if (intake._tag === "Enter" && confidential && !confidential.conversion) {
        const chainId = getConfidentialChainId(confidential.yieldDto);
        const balance =
          chainId === null
            ? null
            : yield* zama.revealTokenBalance({
                chainId,
                owner: intake.request.address,
                token: intake.selectedToken,
              });
        if (balance !== null && balance < confidential.amount) {
          return yield* new ClassicFlowInvalidPreviewError({
            cause: { amount: confidential.amount, balance },
            message: "Amount exceeds the confidential balance.",
            retryable: false,
          });
        }
      }
      const request = decrypt
        ? yield* decryptPreviewRequest(getPreviewRequest(intake))
        : yield* encryptPreviewRequest(getPreviewRequest(intake));
      const action = yield* yieldOperations.previewAction(request);
      const validation = getValidStakeSessionTx(action);
      if (Result.isFailure(validation)) {
        return yield* new ClassicFlowInvalidPreviewError({
          cause: validation.failure,
          message: "Classic Transaction Flow Action preview is not executable.",
          retryable: false,
        });
      }
      return validation.success;
    }).pipe(
      Effect.mapError(
        (cause) =>
          new ClassicFlowPrepareError({
            cause,
            retryable:
              cause._tag !== "InputValidationError" &&
              cause._tag !== "ClassicFlowInvalidPreviewError",
          })
      )
    );

    const confirmOpen = Effect.fn("ClassicFlowReview.confirm")(function* () {
      const eligibility = yield* Ref.get(eligibilityRef);
      if (eligibility.kycBlocking) {
        return { _tag: "RejectedBlocked" } as const;
      }
      if (eligibility.activityExpired) {
        return { _tag: "RejectedExpired" } as const;
      }

      const exitIntake = intake._tag === "Exit" ? intake : null;
      const trackConfirmation = exitIntake
        ? tracking.trackEvent("unstakeClicked", {
            yieldId: exitIntake.integration.id,
            ...(exitIntake.request.arguments?.amount
              ? { amount: exitIntake.request.arguments.amount }
              : {}),
          })
        : Effect.void;
      const promote = (source: ClassicFlowExecutionSource) =>
        promoteToExecution(
          source,
          trackConfirmation,
          Ref.get(eligibilityRef)
        ).pipe(
          Effect.map((promotion) => {
            switch (promotion._tag) {
              case "Promoted":
                return { _tag: "Confirmed" } as const;
              case "RejectedAlreadyReserved":
                return { _tag: "RejectedSession" } as const;
              case "RejectedBlocked":
                return { _tag: "RejectedBlocked" } as const;
              case "RejectedExpired":
                return { _tag: "RejectedExpired" } as const;
            }
          })
        );

      if (confidential || decrypt) {
        const conversionSteps =
          intake._tag === "Enter" && confidential?.conversion
            ? yield* zama
                .conversionSteps({
                  amount: confidential.amount,
                  conversion: confidential.conversion,
                  owner: intake.request.address,
                })
                // An unknown allowance costs at most a redundant reset and approve.
                .pipe(
                  Effect.orElseSucceed(
                    () => ["approve-reset", "approve", "wrap"] as const
                  )
                )
            : [];
        return yield* promote({
          _tag: "Prepare",
          conversionSteps,
          prepare: prepareConfidentialAction,
          step: decrypt ? "decrypt" : "encrypt",
        });
      }

      const initialState = yield* SubscriptionRef.get(stateRef);
      const state = yield* initialState.preview._tag === "Failure" &&
      initialState.preview.error.retryable
        ? loadPreviewOpen.pipe(Effect.andThen(SubscriptionRef.get(stateRef)))
        : Effect.succeed(initialState);
      if (
        state.preview._tag === "Initial" ||
        state.preview._tag === "Loading"
      ) {
        return { _tag: "RejectedNotReady" } as const;
      }
      if (state.preview._tag === "Failure" || !state.preview.action) {
        return { _tag: "RejectedPreview" } as const;
      }
      if (
        intake._tag === "YieldActionContinuation" &&
        state.preview.action.status !== ActionStatus.WAITING_FOR_NEXT
      ) {
        return { _tag: "RejectedPreview" } as const;
      }

      return yield* promote({ _tag: "Action", action: state.preview.action });
    });

    return {
      confirm: () => operations.run(confirmOpen()),
      states: SubscriptionRef.changes(stateRef),
    };
  });
});
