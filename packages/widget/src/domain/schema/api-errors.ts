import { Data, Schema } from "effect";

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
  }
) {}

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
