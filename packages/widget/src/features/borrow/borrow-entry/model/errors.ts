import { Data } from "effect";
import type { BorrowResourceError } from "../../../../resources/borrow-resource-error";

class MissingBorrowApiClient extends Data.TaggedError(
  "MissingBorrowApiClient"
)<{
  readonly message: string;
}> {}

export type BorrowAtomResultError =
  | BorrowResourceError
  | MissingBorrowApiClient;
