import { Option, Schema } from "effect";

const WalletFailure = Schema.Struct({
  code: Schema.optional(Schema.Union([Schema.Finite, Schema.String])),
  name: Schema.optional(Schema.String),
  message: Schema.optional(Schema.String),
  cause: Schema.optional(Schema.Unknown),
});

export const isWalletCancellation = (cause: unknown): boolean => {
  // TonConnect rejects with undefined when its modal is dismissed.
  if (cause === undefined) return true;
  const visited = new Set<unknown>();
  for (let current = cause; !visited.has(current); ) {
    visited.add(current);
    const decoded = Schema.decodeUnknownOption(WalletFailure)(current);
    if (Option.isNone(decoded)) return false;
    const failure = decoded.value;
    if (
      failure.code === 4001 ||
      failure.code === "4001" ||
      failure.name === "UserRejectedRequestError" ||
      failure.name === "WalletWindowClosedError" ||
      /user rejected|request rejected|connection request reset|user closed|modal closed/i.test(
        failure.message ?? ""
      )
    )
      return true;
    if (failure.cause === undefined) return false;
    current = failure.cause;
  }
  return false;
};
