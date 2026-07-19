import { Data } from "effect";

type WalletConnectionCommand = "connect" | "disconnect" | "reconnect";
type WalletSwitchCommand = "account" | "chain";
type WalletSigningCommand = "message" | "transaction";

type WalletCapability =
  | WalletConnectionCommand
  | WalletSwitchCommand
  | WalletSigningCommand
  | "decode-transaction"
  | "broadcast-transaction";

export class WalletConnectionError extends Data.TaggedError(
  "WalletConnectionError"
)<{
  readonly cause: unknown;
  readonly operation: WalletConnectionCommand;
}> {}

export class WalletSwitchError extends Data.TaggedError("WalletSwitchError")<{
  readonly cause: unknown;
  readonly operation: WalletSwitchCommand;
  readonly target: number | string;
}> {}

export class WalletSigningError extends Data.TaggedError("WalletSigningError")<{
  readonly cause: unknown;
  readonly operation: WalletSigningCommand;
}> {}

export class WalletDecodeError extends Data.TaggedError("WalletDecodeError")<{
  readonly cause: unknown;
}> {}

export class WalletBroadcastError extends Data.TaggedError(
  "WalletBroadcastError"
)<{
  readonly cause: unknown;
  readonly customMessage: string | null;
}> {}

export class WalletCapabilityUnavailableError extends Data.TaggedError(
  "WalletCapabilityUnavailableError"
)<{
  readonly capability: WalletCapability;
  readonly connectorId: string | null;
}> {}

export class WalletRuntimeInvariantError extends Data.TaggedError(
  "WalletRuntimeInvariantError"
)<{
  readonly reason:
    | "external-provider-connector-mismatch"
    | "external-provider-connector-missing"
    | "external-provider-presence-changed"
    | "wallet-topology-changed";
}> {}
