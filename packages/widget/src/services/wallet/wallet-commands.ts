import type { Account } from "@ledgerhq/wallet-api-client";
import type { Address } from "viem";
import type { Connector } from "wagmi";
import type { SKEip712TypedData } from "../../public-api/types";

export type WalletConnectInput = {
  readonly chainId?: number;
  readonly connector: Connector;
};

export type WalletDisconnectInput = {
  readonly connector?: Connector;
};

export type WalletReconnectInput = {
  readonly connectors?: ReadonlyArray<Connector>;
};

export type WalletSwitchChainInput = {
  readonly chainId: number;
  readonly connector?: Connector;
};

export type WalletSwitchAccountInput = {
  readonly account: Account;
  readonly connector: Connector;
};

export type WalletSignMessageInput = {
  readonly account?: Address;
  readonly connector?: Connector;
  readonly message: string;
};

export type WalletSignTypedDataInput = SKEip712TypedData & {
  readonly account?: Address;
  readonly connector?: Connector;
};
