import { Data, Effect } from "effect";

type BorrowResourceOperation =
  | "borrow-integrations"
  | "borrow-markets"
  | "borrow-position"
  | "borrow-positions";

export class BorrowResourceError extends Data.TaggedError(
  "BorrowResourceError"
)<{
  readonly cause: unknown;
  readonly operation: BorrowResourceOperation;
}> {}

export const withBorrowResourceError =
  (operation: BorrowResourceOperation) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    effect.pipe(
      Effect.mapError((cause) => new BorrowResourceError({ cause, operation }))
    );
