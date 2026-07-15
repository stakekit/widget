import type { Account } from "@ledgerhq/wallet-api-client";
import type { Chain as RainbowKitChain } from "@stakekit/rainbowkit";
import type { Chain } from "viem";
import type { Connector } from "wagmi";
import type { AdditionalAddresses } from "../../../domain/schema/address-models";
import type { WalletAddress } from "../../../domain/schema/identifiers";
import type { SupportedSKChains } from "../../../domain/types/chains";

export type LedgerConnectorState = {
  readonly accounts: Account[];
  readonly currentAccountId: string | undefined;
  readonly disabledChains: RainbowKitChain[];
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

export type NormalizedWalletState = WalletStateCommon &
  (
    | {
        readonly additionalAddresses: AdditionalAddresses | null;
        readonly address: typeof WalletAddress.Type;
        readonly chain: Chain;
        readonly connector: Connector;
        readonly isLedgerLiveAccountPlaceholder: boolean;
        readonly ledgerAccounts: Account[];
        readonly network: SupportedSKChains;
        readonly status: "connected";
      }
    | {
        readonly additionalAddresses: null;
        readonly address: null;
        readonly chain: null;
        readonly connector: null;
        readonly isLedgerLiveAccountPlaceholder: false;
        readonly ledgerAccounts: null;
        readonly network: null;
        readonly status: "connecting" | "disconnected";
      }
    | {
        readonly additionalAddresses: null;
        readonly address: typeof WalletAddress.Type | null;
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
