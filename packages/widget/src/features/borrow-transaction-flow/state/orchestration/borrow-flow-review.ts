import { Data, Effect, type Scope } from "effect";
import {
  type Action,
  isTerminalBorrowActionStatus,
} from "../../../../domain/borrow/execution/action";
import { BorrowOperations } from "../../../../services/api/operations";
import type { WidgetNavigationError } from "../../../../services/navigation/widget-navigation";
import { makeScopedSerialOperations } from "../../../../shared/effect/scoped-serial-operations";

export class BorrowActionCreationError extends Data.TaggedError(
  "BorrowActionCreationError"
)<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

const validateCreatedAction = (action: Action) =>
  isTerminalBorrowActionStatus(action.status)
    ? Effect.fail(
        new BorrowActionCreationError({
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
      Effect.mapError(
        (cause) =>
          new BorrowActionCreationError({
            cause,
            message: "Borrow action could not be created.",
          })
      ),
      Effect.flatMap(validateCreatedAction)
    );

    return {
      back: () => operations.run(back),
      confirm: () => operations.run(confirmAction(createAction)),
    };
  });
});
