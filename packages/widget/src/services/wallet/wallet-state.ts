import type { Account } from "@ledgerhq/wallet-api-client";
import type { Chain as RainbowKitChain } from "@stakekit/rainbowkit";
import type { Chain } from "viem";
import type { Connector } from "wagmi";
import type { getConnection } from "wagmi/actions";
import type { WalletAddress } from "../../domain/identity/identifiers";
import type { AdditionalAddresses } from "../../domain/wallet/address";
import type { WalletNetwork } from "../../domain/wallet/network";

export type LedgerConnectorState = {
  readonly accounts: Account[];
  readonly currentAccountId: string | undefined;
  readonly disabledChains: RainbowKitChain[];
};

export type WalletState = {
  readonly connection: NormalizedWalletState;
  readonly ledger: LedgerConnectorState;
};

export type WalletCoreState = {
  readonly connection: ReturnType<typeof getConnection>;
  readonly connectors: ReadonlyArray<Connector>;
};

export const disconnectedLedgerConnectorState: LedgerConnectorState = {
  accounts: [],
  currentAccountId: undefined,
  disabledChains: [],
};

type WalletStateCommon = {
  readonly connectorChains: Chain[];
  readonly isLedgerLive: boolean;
};

type WalletScopeOwnerState = {
  readonly additionalAddresses: AdditionalAddresses | null;
  readonly address: WalletAddress;
  readonly chain: Chain;
  readonly connector: Connector;
  readonly isLedgerLiveAccountPlaceholder: boolean;
  readonly ledgerAccounts: Account[];
  readonly network: WalletNetwork;
};

type WalletWithoutScopeOwnerState = {
  readonly additionalAddresses: null;
  readonly address: null;
  readonly chain: null;
  readonly connector: null;
  readonly isLedgerLiveAccountPlaceholder: false;
  readonly ledgerAccounts: null;
  readonly network: null;
};

export type NormalizedWalletState = WalletStateCommon &
  (
    | (WalletScopeOwnerState & {
        readonly status: "connected";
      })
    | ((WalletScopeOwnerState | WalletWithoutScopeOwnerState) & {
        readonly status: "connecting";
      })
    | (WalletWithoutScopeOwnerState & {
        readonly status: "disconnected";
      })
    | {
        readonly additionalAddresses: null;
        readonly address: WalletAddress | null;
        readonly chain: Chain | null;
        readonly connector: Connector | null;
        readonly isLedgerLiveAccountPlaceholder: false;
        readonly ledgerAccounts: null;
        readonly network: null;
        readonly status: "unsupported";
      }
  );

export const disconnectedNormalizedWalletState = {
  additionalAddresses: null,
  address: null,
  chain: null,
  connector: null,
  connectorChains: [],
  isLedgerLive: false,
  isLedgerLiveAccountPlaceholder: false,
  ledgerAccounts: null,
  network: null,
  status: "disconnected",
} satisfies NormalizedWalletState;
