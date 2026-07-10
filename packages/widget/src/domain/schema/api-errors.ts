import { Schema } from "effect";

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

export class ApiResourceNotFound extends Schema.TaggedErrorClass<ApiResourceNotFound>()(
  "ApiResourceNotFound",
  {
    operation: Schema.String,
    identifier: Schema.optionalKey(Schema.String),
  }
) {}

export type ApiBoundaryError =
  | ApiRequestError
  | ApiResourceNotFound
  | ResponseDecodeError;
