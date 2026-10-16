import { Data, Effect, Option, type Scope } from "effect";
import {
  type Action,
  isTerminalBorrowActionStatus,
} from "../../../../domain/borrow/execution/action";
import {
  type BorrowOperationFailure,
  BorrowOperations,
  getApiRejectionReason,
} from "../../../../services/api/operations";
import type { WidgetNavigationError } from "../../../../services/navigation/widget-navigation";
import { makeScopedSerialOperations } from "../../../../shared/effect/scoped-serial-operations";

/** The API refused to create the action and said why. */
class BorrowActionRejected extends Data.TaggedError("BorrowActionRejected")<{
  readonly reason: string;
}> {}

/** The action could not be created for a reason the user cannot act on. */
class BorrowActionCreationFailed extends Data.TaggedError(
  "BorrowActionCreationFailed"
)<{
  readonly cause?: BorrowOperationFailure;
  readonly message: string;
}> {}

export type BorrowActionCreationError =
  | BorrowActionCreationFailed
  | BorrowActionRejected;

const toCreationError = (
  cause: BorrowOperationFailure
): BorrowActionCreationError =>
  Option.match(
    cause._tag === "ApiRequestError"
      ? getApiRejectionReason(cause.failure)
      : Option.none(),
    {
      onNone: () =>
        new BorrowActionCreationFailed({
          cause,
          message: "Borrow action could not be created.",
        }),
      onSome: (reason) => new BorrowActionRejected({ reason }),
    }
  );

const validateCreatedAction = (action: Action) =>
  isTerminalBorrowActionStatus(action.status)
    ? Effect.fail(
        new BorrowActionCreationFailed({
          message: `Borrow action ended with ${action.status} status.`,
        })
      )
    : Effect.succeed(action);

type BorrowFlowReviewOutcome =
  | Readonly<{ readonly _tag: "Confirmed" }>
  | Readonly<{ readonly _tag: "RejectedAlreadyReserved" }>;

export type BorrowFlowReviewHandle = Readonly<{
  readonly back: () => Effect.Effect<void, WidgetNavigationError>;
  readonly confirm: () => Effect.Effect<
    BorrowFlowReviewOutcome,
    BorrowActionCreationError | WidgetNavigationError
  >;
}>;

type ConfirmBorrowAction = (
  createAction: Effect.Effect<Action, BorrowActionCreationError>
) => Effect.Effect<
  BorrowFlowReviewOutcome,
  BorrowActionCreationError | WidgetNavigationError
>;

export const makeBorrowFlowReviewFactory = Effect.fn(
  "makeBorrowFlowReviewFactory"
)(function* () {
  const borrowOperations = yield* BorrowOperations;

  return Effect.fn("makeBorrowFlowReview")(function* ({
    back,
    command,
    confirmAction,
  }: {
    readonly back: Effect.Effect<void, WidgetNavigationError>;
    readonly command: Parameters<
      BorrowOperations["Service"]["executeAction"]
    >[0];
    readonly confirmAction: ConfirmBorrowAction;
  }): Effect.fn.Return<BorrowFlowReviewHandle, never, Scope.Scope> {
    const operations = yield* makeScopedSerialOperations();

    const createAction = Effect.suspend(() =>
      borrowOperations.executeAction(command)
    ).pipe(
      Effect.mapError(toCreationError),
      Effect.flatMap(validateCreatedAction)
    );

    return {
      back: () => operations.run(back),
      confirm: () => operations.run(confirmAction(createAction)),
    };
  });
});
