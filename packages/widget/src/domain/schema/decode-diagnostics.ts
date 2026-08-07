import { Effect } from "effect";

type DecodeRejectionDiagnostic = {
  readonly operation: string;
  readonly location: number | string;
  readonly identifier?: string;
  readonly issue: string;
};

type DecodeFieldRejectionDiagnostic = {
  readonly operation: string;
  readonly field: string;
  readonly issue: string;
};

export const logDecodeRejection = (diagnostic: DecodeRejectionDiagnostic) =>
  Effect.logWarning("Rejected API response entry").pipe(
    Effect.annotateLogs({
      event: "api_decode_rejection",
      operation: diagnostic.operation,
      location: String(diagnostic.location),
      issue: diagnostic.issue,
      ...(diagnostic.identifier ? { identifier: diagnostic.identifier } : {}),
    })
  );

export const logDecodeFieldRejection = (
  diagnostic: DecodeFieldRejectionDiagnostic
) =>
  Effect.logWarning("Ignored invalid optional API response field").pipe(
    Effect.annotateLogs({
      event: "api_decode_field_rejection",
      operation: diagnostic.operation,
      field: diagnostic.field,
      issue: diagnostic.issue,
    })
  );
