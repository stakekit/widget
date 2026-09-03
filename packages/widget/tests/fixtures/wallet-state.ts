import type { WalletScopeKey } from "../../src/domain/wallet/wallet-scope";
import type {
  LedgerConnectorState,
  NormalizedWalletState,
  WalletState,
} from "../../src/services/wallet/wallet-state";
import {
  disconnectedLedgerConnectorState,
  disconnectedNormalizedWalletState,
} from "../../src/services/wallet/wallet-state";

type ConnectedWalletConnection = Extract<
  NormalizedWalletState,
  { readonly status: "connected" }
>;

type ConnectingWalletConnection = Omit<ConnectedWalletConnection, "status"> & {
  readonly status: "connecting";
};

export type ConnectedWalletState = WalletState &
  Readonly<{
    readonly connection: ConnectedWalletConnection;
    readonly ledger: LedgerConnectorState;
  }>;

export type ConnectingWalletState = WalletState &
  Readonly<{
    readonly connection: ConnectingWalletConnection;
    readonly ledger: LedgerConnectorState;
  }>;

const makeLedgerState = (): LedgerConnectorState => ({
  accounts: [],
  currentAccountId: undefined,
  disabledChains: [],
});

const makeOwnedConnection = (
  scope: WalletScopeKey
): Omit<ConnectedWalletConnection, "status"> => ({
  additionalAddresses: scope.additionalAddresses,
  address: scope.address,
  chain: {} as ConnectedWalletConnection["chain"],
  connector: {} as ConnectedWalletConnection["connector"],
  connectorChains: [],
  isLedgerLive: false,
  isLedgerLiveAccountPlaceholder: false,
  ledgerAccounts: [],
  network: scope.network,
});

export const makeConnectedWalletState = (
  scope: WalletScopeKey
): ConnectedWalletState => ({
  connection: {
    ...makeOwnedConnection(scope),
    status: "connected",
  },
  ledger: makeLedgerState(),
});

export const makeConnectingWalletState = (
  scope: WalletScopeKey
): ConnectingWalletState => ({
  connection: {
    ...makeOwnedConnection(scope),
    status: "connecting",
  },
  ledger: makeLedgerState(),
});

export const makeDisconnectedWalletState = (): WalletState => ({
  connection: {
    ...disconnectedNormalizedWalletState,
    connectorChains: [],
  },
  ledger: {
    ...disconnectedLedgerConnectorState,
    accounts: [],
    disabledChains: [],
  },
});
