import { Data } from "effect";

export class MissingBorrowApiClient extends Data.TaggedError(
  "MissingBorrowApiClient"
)<{
  readonly message: string;
}> {}
