import type { Account } from "@ledgerhq/wallet-api-client";
import type { Address } from "viem";
import type { Connector } from "wagmi";

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
