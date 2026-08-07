import { Data, Schema } from "effect";

export const RichError = Schema.Struct({
  message: Schema.String,
  details: Schema.optionalKey(Schema.Record(Schema.String, Schema.Unknown)),
});
export type RichError = typeof RichError.Type;

export class MissingBorrowApiConfig extends Data.TaggedError(
  "MissingBorrowApiConfig"
)<{
  readonly message: string;
}> {}

export class ApiRequestError extends Schema.TaggedErrorClass<ApiRequestError>()(
  "ApiRequestError",
  {
    operation: Schema.String,
    cause: Schema.Defect(),
    richError: Schema.NullOr(RichError),
  }
) {
  constructor(input: {
    readonly operation: string;
    readonly cause: unknown;
    readonly richError?: RichError | null;
  }) {
    super({ ...input, richError: input.richError ?? null });
  }
}

export class ResponseDecodeError extends Schema.TaggedErrorClass<ResponseDecodeError>()(
  "ResponseDecodeError",
  {
    operation: Schema.String,
    issue: Schema.String,
    cause: Schema.Defect(),
  }
) {}

export class InputValidationError extends Schema.TaggedErrorClass<InputValidationError>()(
  "InputValidationError",
  {
    operation: Schema.String,
    issue: Schema.String,
    cause: Schema.Defect(),
  }
) {}
