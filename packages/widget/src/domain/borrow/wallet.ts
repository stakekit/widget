import { Schema } from "effect";
import { ChainId, WalletAddress } from "./ids";
import { BorrowNetwork } from "./network";

const WalletAccount = Schema.Struct({
  address: WalletAddress,
});
export const WalletChain = Schema.Struct({
  chainId: ChainId,
  name: Schema.String,
  network: BorrowNetwork,
  iconUrl: Schema.optionalKey(Schema.String),
});
export type WalletChain = typeof WalletChain.Type;

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
