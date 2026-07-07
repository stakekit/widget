import { Data, type Effect, Schema, type Stream } from "effect";
import { ChainId, WalletAddress } from "./ids";
import { BorrowNetwork } from "./network";

const HexString = Schema.TemplateLiteral([Schema.Literal("0x"), Schema.String]);
export type HexString = typeof HexString.Type;

export const WalletAccount = Schema.Struct({
  address: WalletAddress,
});
export type WalletAccount = typeof WalletAccount.Type;

export const WalletChain = Schema.Struct({
  chainId: ChainId,
  name: Schema.String,
  network: BorrowNetwork,
  iconUrl: Schema.optionalKey(Schema.String),
});
export type WalletChain = typeof WalletChain.Type;

export const BorrowWalletTransactionRequest = Schema.Struct({
  account: WalletAddress,
  to: HexString,
  data: HexString,
  gas: Schema.BigInt,
  value: Schema.optionalKey(Schema.BigInt),
});
export type BorrowWalletTransactionRequest =
  typeof BorrowWalletTransactionRequest.Type;

export const DisconnectedWalletState = Schema.Struct({
  status: Schema.Literal("disconnected"),
});
export type DisconnectedWalletState = typeof DisconnectedWalletState.Type;

export const ConnectedWalletState = Schema.Struct({
  status: Schema.Literal("connected"),
  currentAccount: WalletAccount,
  accounts: Schema.NonEmptyArray(WalletAccount),
  currentChain: WalletChain,
  chains: Schema.NonEmptyArray(WalletChain),
  network: BorrowNetwork,
});
export type ConnectedWalletState = typeof ConnectedWalletState.Type;

export const WalletState = Schema.Union([
  DisconnectedWalletState,
  ConnectedWalletState,
]);
export type WalletState = typeof WalletState.Type;

export class SendTransactionError extends Data.TaggedError(
  "BorrowSendTransactionError"
)<{
  readonly cause: unknown;
}> {}

export class SwitchAccountError extends Data.TaggedError(
  "BorrowSwitchAccountError"
)<{
  readonly cause: unknown;
}> {}

export class SwitchChainError extends Data.TaggedError(
  "BorrowSwitchChainError"
)<{
  readonly cause: unknown;
}> {}

export type BorrowWalletAdapter = {
  readonly mode: "default" | "external";
  readonly getState: () => WalletState;
  readonly changes: Stream.Stream<WalletState>;
  readonly sendTransaction: (
    request: BorrowWalletTransactionRequest
  ) => Effect.Effect<HexString, SendTransactionError>;
  readonly switchAccount: (
    address: WalletAddress
  ) => Effect.Effect<void, SwitchAccountError>;
  readonly switchChain: (
    chainId: ChainId
  ) => Effect.Effect<void, SwitchChainError>;
};

export type ExternalBorrowWalletAdapter = {
  readonly getState: () => ConnectedWalletState;
  readonly subscribe: (
    listener: (state: ConnectedWalletState) => void
  ) => () => void;
  readonly sendTransaction: (
    request: BorrowWalletTransactionRequest
  ) => Promise<HexString>;
  readonly switchAccount: (address: WalletAddress) => Promise<void>;
  readonly switchChain: (chainId: ChainId) => Promise<void>;
};
