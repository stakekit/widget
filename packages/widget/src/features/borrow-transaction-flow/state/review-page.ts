import { Cause, Data, Effect, Option, Ref, Schema } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";

import { isTerminalBorrowActionStatus } from "../../../domain/borrow/action";
import { walletRuntime } from "../../../runtime/wallet-runtime";
import {
  type BorrowOperationFailure,
  BorrowOperations,
  getApiRejectionReason,
} from "../../../services/api/operations";
import {
  WidgetNavigation,
  type WidgetNavigationError,
} from "../../../services/navigation/widget-navigation";
import {
  handOffTransactionFlow,
  makeTransactionFlowReviewPage,
} from "../../transaction-flow/index";
import {
  type BorrowFlowSession,
  getBorrowTransactionFlowDestination,
} from "../model/session";
import { leaveBorrowFlow } from "./borrow-flow-session";

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

type BorrowActionCreationError =
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

/** Why the last Review confirmation failed, as the Review page explains it. */
export const BorrowReviewConfirmationFailure = Schema.TaggedUnion({
  /** The API refused the action; its reason arrives in English only. */
  Rejected: { reason: Schema.String },
  /** The action could not be prepared for any other reason. */
  Failed: {},
});
export type BorrowReviewConfirmationFailure =
  typeof BorrowReviewConfirmationFailure.Type;

const failed = BorrowReviewConfirmationFailure.cases.Failed.make({});

const toBorrowReviewConfirmationFailure = (
  error: BorrowActionCreationError | WidgetNavigationError
): BorrowReviewConfirmationFailure =>
  error._tag === "BorrowActionRejected"
    ? BorrowReviewConfirmationFailure.cases.Rejected.make({
        reason: error.reason,
      })
    : failed;

/** What the Review page shows of its confirm command. */
export type BorrowReviewConfirmation = {
  readonly pending: boolean;
  readonly failure: Option.Option<BorrowReviewConfirmationFailure>;
};

/**
 * The runtime running the confirm command can fail it with its own errors;
 * only a refusal the API explained is presented as such.
 */
export const toBorrowReviewConfirmation = <A, E>(
  result: AsyncResult.AsyncResult<A, BorrowReviewConfirmationFailure | E>
): BorrowReviewConfirmation => ({
  failure:
    AsyncResult.isFailure(result) && !result.waiting
      ? Option.some(
          Cause.findErrorOption(result.cause).pipe(
            Option.filter(BorrowReviewConfirmationFailure.guards.Rejected),
            Option.getOrElse((): BorrowReviewConfirmationFailure => failed)
          )
        )
      : Option.none(),
  pending: result.waiting,
});

/**
 * Creates the reviewed action and hands it to the Execution that Steps opens,
 * once: while the Session holds a handoff, another confirmation is rejected.
 */
export const confirmBorrowAction = Effect.fn("confirmBorrowAction")(function* (
  session: BorrowFlowSession
) {
  const { handoff } = session;
  if (yield* Ref.get(handoff)) {
    return { _tag: "RejectedConfirmed" } as const;
  }
  const borrowOperations = yield* BorrowOperations;
  const action = yield* borrowOperations
    .executeAction(session.intake.command)
    .pipe(Effect.mapError(toCreationError));
  if (isTerminalBorrowActionStatus(action.status)) {
    return yield* new BorrowActionCreationFailed({
      message: `Borrow action ended with ${action.status} status.`,
    });
  }

  const navigation = yield* WidgetNavigation;
  const destination = getBorrowTransactionFlowDestination(session.intake.entry);
  return yield* handOffTransactionFlow(
    handoff,
    { _tag: "Waiting", action },
    navigation.execute({
      _tag: "Push",
      to: destination.steps({
        borrowFlowSession: session,
        executionActionId: action.id,
      }),
    })
  );
});

/** One arrival at a Session's Review: its history entry's key. */
export class BorrowFlowReviewVisit extends Data.Class<{
  readonly session: BorrowFlowSession;
  readonly visit: string;
}> {}

/**
 * Review's commands for one visit. Every render of a visit gets the same
 * Atoms; leaving Review interrupts an action still being created.
 *
 * Arriving also releases an action still waiting for a Steps that never
 * started it; see `makeTransactionFlowReviewPage`.
 */
export const borrowFlowReviewPage = Atom.family(
  ({ session }: BorrowFlowReviewVisit) =>
    makeTransactionFlowReviewPage(
      session.handoff,
      makeBorrowFlowReviewPage(session)
    ).pipe(Atom.withLabel("borrowFlowReviewPage"))
);

export const makeBorrowFlowReviewPage = (session: BorrowFlowSession) => ({
  backAtom: walletRuntime
    .fn(() => leaveBorrowFlow("Review"), { initialValue: undefined })
    .pipe(Atom.withLabel("backBorrowFlowReview")),
  confirmAtom: walletRuntime
    .fn(
      () =>
        confirmBorrowAction(session).pipe(
          Effect.mapError(toBorrowReviewConfirmationFailure)
        ),
      {
        concurrent: false,
        initialValue: undefined,
      }
    )
    .pipe(
      Atom.map(toBorrowReviewConfirmation),
      Atom.withLabel("confirmBorrowFlowReview")
    ),
});
