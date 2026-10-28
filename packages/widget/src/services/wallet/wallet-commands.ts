import type { Account } from "@ledgerhq/wallet-api-client";
import type { Address, Hex } from "viem";
import type { Connector } from "wagmi";
import type { WalletScopeOwner } from "../../domain/wallet/wallet-scope";
import type { BorrowTransactionMeta } from "./wallet-transactions";

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
  // `undefined` is passed to override a connector with Wagmi's current one.
  readonly connector?: Connector | undefined;
  readonly message: string;
};

export type WalletSignTypedDataInput = Eip712TypedData & {
  readonly account?: Address;
  // `undefined` is passed to override a connector with Wagmi's current one.
  readonly connector?: Connector | undefined;
};

type ZamaPermitMeta = {
  readonly address: string;
  readonly chainId: number;
  readonly contracts: ReadonlyArray<string>;
};

export type WalletSignPermitInput = {
  readonly meta: ZamaPermitMeta;
  readonly typedData: Eip712TypedData;
};

export type WalletSignBorrowTypedDataInput = {
  readonly txMeta: BorrowTransactionMeta;
  readonly typedData: Eip712TypedData;
};

/**
 * A signing command bound to the Wallet Scope Owner its caller captured. The
 * Wallet Service checks it against the Wallet Command Context it dispatches
 * with.
 */
export type WalletOwnerCheckedInput<Input> = Input & {
  readonly expectedOwner: WalletScopeOwner;
};
