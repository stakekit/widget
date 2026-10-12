import type { Account } from "@ledgerhq/wallet-api-client";
import type { Address, Hex } from "viem";
import type { Connector } from "wagmi";

export type Eip712TypedData = {
  readonly domain: {
    readonly chainId?: number;
    readonly name?: string;
    readonly salt?: Hex;
    readonly verifyingContract?: Hex;
    readonly version?: string;
  };
  readonly message: Readonly<Record<string, unknown>>;
  readonly primaryType: string;
  readonly types: Readonly<
    Record<
      string,
      ReadonlyArray<{ readonly name: string; readonly type: string }>
    >
  >;
};

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

export type WalletSignTypedDataInput = Eip712TypedData & {
  readonly account?: Address;
  readonly connector?: Connector;
};
