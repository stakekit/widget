import { Data } from "effect";

export class BorrowFeatureDisabled extends Data.TaggedError(
  "BorrowFeatureDisabled"
)<{
  readonly message: string;
}> {}
