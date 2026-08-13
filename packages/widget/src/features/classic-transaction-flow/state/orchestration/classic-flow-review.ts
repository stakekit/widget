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
import { getValidStakeSessionTx } from "../../../../domain";
import type {
  ActionCommand,
  ManageActionCommand,
  YieldAction,
} from "../../../../domain/action/models";
import { YieldOperations } from "../../../../services/api/yield-operations";
import type { WidgetNavigationError } from "../../../../services/navigation/widget-navigation";
import { TrackingService } from "../../../../services/tracking/tracking-service";
import { makeScopedSerialOperations } from "../../../../shared/effect/scoped-serial-operations";
import type { ClassicTransactionFlowIntake } from "../../model/classic-transaction-flow";

class ClassicFlowPreviewError extends Data.TaggedError(
  "ClassicFlowPreviewError"
)<{
  readonly cause: unknown;
  readonly message: string;
  readonly retryable: true;
}> {}

class ClassicFlowInvalidExitPreviewError extends Data.TaggedError(
  "ClassicFlowInvalidExitPreviewError"
)<{
  readonly cause: unknown;
  readonly message: string;
  readonly retryable: false;
}> {}

class ClassicFlowUnsupportedActivityPreviewError extends Data.TaggedError(
  "ClassicFlowUnsupportedActivityPreviewError"
)<{
  readonly message: string;
  readonly retryable: false;
}> {}

type ClassicFlowReviewError =
  | ClassicFlowInvalidExitPreviewError
  | ClassicFlowPreviewError
  | ClassicFlowUnsupportedActivityPreviewError;

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
  | Readonly<{ readonly _tag: "RejectedSession" }>
  | Readonly<{ readonly _tag: "RejectedStale" }>;

export type ClassicFlowReviewHandle = Readonly<{
  readonly confirm: () => Effect.Effect<
    ClassicFlowReviewOutcome,
    ClassicFlowReviewError | WidgetNavigationError
  >;
  readonly states: Stream.Stream<ClassicFlowReviewState>;
}>;

type PromoteToExecution = (
  action: YieldAction,
  afterReservation: Effect.Effect<void>,
  eligibility: Effect.Effect<ClassicFlowReviewEligibility>
) => Effect.Effect<
  | Readonly<{ readonly _tag: "Promoted" }>
  | Readonly<{ readonly _tag: "RejectedAlreadyReserved" }>
  | Readonly<{ readonly _tag: "RejectedBlocked" }>
  | Readonly<{ readonly _tag: "RejectedExpired" }>
  | Readonly<{ readonly _tag: "RejectedStale" }>,
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
  intake: ClassicTransactionFlowIntake
): ActionPreviewRequest | null => {
  switch (intake._tag) {
    case "Enter":
      return { command: intake.request, intent: "enter" };
    case "Exit":
      return { command: intake.request, intent: "exit" };
    case "Manage":
      return { command: intake.request, intent: "manage" };
    case "ActivityResume": {
      if (intake.action.intent === "manage") return null;
      return {
        command: {
          address: intake.action.address,
          ...(intake.action.rawArguments
            ? { arguments: intake.action.rawArguments }
            : {}),
          yieldId: intake.action.yieldId,
        },
        intent: intake.action.intent,
      };
    }
  }
};

const unsupportedPreview = new ClassicFlowUnsupportedActivityPreviewError({
  message:
    "This Activity action cannot be recreated as a fresh Action preview.",
  retryable: false,
});

export const makeClassicFlowReviewFactory = Effect.fn(
  "makeClassicFlowReviewFactory"
)(function* () {
  const tracking = yield* TrackingService;
  const yieldOperations = yield* YieldOperations;

  return Effect.fn("makeClassicFlowReview")(function* ({
    eligibilityStates,
    intake,
    isCurrent,
    promoteToExecution,
  }: {
    readonly eligibilityStates: Stream.Stream<ClassicFlowReviewEligibility>;
    readonly intake: ClassicTransactionFlowIntake;
    readonly isCurrent: Effect.Effect<boolean>;
    readonly promoteToExecution: PromoteToExecution;
  }): Effect.fn.Return<ClassicFlowReviewHandle, never, Scope.Scope> {
    const eligibilityRef = yield* Ref.make<ClassicFlowReviewEligibility>({
      activityExpired: true,
      kycBlocking: true,
    });
    const previewRequest = getPreviewRequest(intake);
    const stateRef = yield* SubscriptionRef.make<ClassicFlowReviewState>({
      preview: previewRequest
        ? { _tag: "Initial" }
        : { _tag: "Failure", error: unsupportedPreview },
    });
    yield* Effect.addFinalizer(() => PubSub.shutdown(stateRef.pubsub));
    const operations = yield* makeScopedSerialOperations();

    const loadPreviewOpen = Effect.gen(function* () {
      if (!previewRequest) return yield* unsupportedPreview;
      yield* SubscriptionRef.set(stateRef, { preview: { _tag: "Loading" } });
      const action = yield* yieldOperations.previewAction(previewRequest).pipe(
        Effect.mapError(
          (cause) =>
            new ClassicFlowPreviewError({
              cause,
              message: "Classic Transaction Flow Action preview failed.",
              retryable: true,
            })
        )
      );
      if (intake._tag !== "Exit") return action;

      const validation = getValidStakeSessionTx(action);
      if (Result.isFailure(validation)) {
        return yield* new ClassicFlowInvalidExitPreviewError({
          cause: validation.failure,
          message: "Classic Transaction Flow Exit preview is not executable.",
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

    const confirmOpen = Effect.fn("ClassicFlowReview.confirm")(function* () {
      if (!(yield* isCurrent)) {
        return { _tag: "RejectedStale" } as const;
      }
      const eligibility = yield* Ref.get(eligibilityRef);
      if (eligibility.kycBlocking) {
        return { _tag: "RejectedBlocked" } as const;
      }
      if (eligibility.activityExpired) {
        return { _tag: "RejectedExpired" } as const;
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

      const exitIntake = intake._tag === "Exit" ? intake : null;
      const trackConfirmation = exitIntake
        ? tracking.trackEvent("unstakeClicked", {
            yieldId: exitIntake.integration.id,
            ...(exitIntake.request.arguments?.amount
              ? { amount: exitIntake.request.arguments.amount }
              : {}),
          })
        : Effect.void;
      const promotion = yield* promoteToExecution(
        state.preview.action,
        trackConfirmation,
        Ref.get(eligibilityRef)
      );
      switch (promotion._tag) {
        case "Promoted":
          return { _tag: "Confirmed" } as const;
        case "RejectedStale":
          return { _tag: "RejectedStale" } as const;
        case "RejectedAlreadyReserved":
          return { _tag: "RejectedSession" } as const;
        case "RejectedBlocked":
          return { _tag: "RejectedBlocked" } as const;
        case "RejectedExpired":
          return { _tag: "RejectedExpired" } as const;
      }
    });

    return {
      confirm: () => operations.run(confirmOpen()),
      states: SubscriptionRef.changes(stateRef),
    };
  });
});
