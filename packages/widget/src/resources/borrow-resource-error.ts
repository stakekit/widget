import { Data, Effect } from "effect";
import type {
  ApiRequestError,
  MissingBorrowApiConfig,
  ResponseDecodeError,
} from "../services/api/resource-sources";

type BorrowResourceOperation =
  | "borrow-integrations"
  | "borrow-markets"
  | "borrow-position"
  | "borrow-positions";
type BorrowResourceCause =
  | ApiRequestError
  | MissingBorrowApiConfig
  | ResponseDecodeError;

export class BorrowResourceError extends Data.TaggedError(
  "BorrowResourceError"
)<{
  readonly cause: BorrowResourceCause;
  readonly operation: BorrowResourceOperation;
}> {}

export const withBorrowResourceError =
  (operation: BorrowResourceOperation) =>
  <A, E extends BorrowResourceCause, R>(effect: Effect.Effect<A, E, R>) =>
    effect.pipe(
      Effect.mapError((cause) => new BorrowResourceError({ cause, operation }))
    );
