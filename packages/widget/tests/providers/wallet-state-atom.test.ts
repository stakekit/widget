import type { Account } from "@ledgerhq/wallet-api-client";
import { mainnet, optimism } from "viem/chains";
import { describe, expect, it } from "vitest";
import type { Connector } from "wagmi";
import { evmChainsMap } from "../../src/services/wallet/internal/adapters/evm/chains";
import {
  normalizeWalletState,
  transitionalWalletState,
  type WalletStateController,
} from "../../src/services/wallet/internal/runtime/state-projection";
import type { WalletCoreState } from "../../src/services/wallet/wallet-state";
import { disconnectedLedgerConnectorState } from "../../src/services/wallet/wallet-state";

type WalletConnectionSnapshot = WalletCoreState["connection"];

const disconnectedWalletConnection: WalletConnectionSnapshot = {
  address: undefined,
  addresses: undefined,
  chain: undefined,
  chainId: undefined,
  connector: undefined,
  isConnected: false,
  isConnecting: false,
  isDisconnected: true,
  isReconnecting: false,
  status: "disconnected",
};

const address = "0x0000000000000000000000000000000000000001";
const forceAddress = "0x0000000000000000000000000000000000000002";
const connector = { id: "mock" } as Connector;
const controller: WalletStateController = {
  cosmosConfig: { cosmosChainsMap: {} },
  evmConfig: { evmChainsMap: { ethereum: evmChainsMap.ethereum } },
  isLedgerLive: false,
  miscConfig: { miscChainsMap: {} },
  substrateConfig: { substrateChainsMap: {} },
};
const connected = {
  ...disconnectedWalletConnection,
  address,
  addresses: [address],
  chain: mainnet,
  chainId: mainnet.id,
  connector,
  isConnected: true,
  isDisconnected: false,
  status: "connected",
} as WalletConnectionSnapshot;

const normalize = (
  connection: WalletConnectionSnapshot,
  overrides: Partial<Parameters<typeof normalizeWalletState>[0]> = {}
) =>
  normalizeWalletState({
    additionalAddresses: null,
    connection,
    connectorChains: [mainnet],
    controller,
    forceAddress: undefined,
    ledgerState: disconnectedLedgerConnectorState,
    ...overrides,
  });

describe("normalized wallet state atom", () => {
  it("distinguishes disconnected and connecting core states", () => {
    expect(normalize(disconnectedWalletConnection)).toMatchObject({
      address: null,
      network: null,
      status: "disconnected",
    });
    expect(
      normalize({
        ...disconnectedWalletConnection,
        isConnecting: true,
        isDisconnected: false,
        status: "connecting",
      } as WalletConnectionSnapshot)
    ).toMatchObject({ status: "connecting" });
    expect(
      normalize({
        ...disconnectedWalletConnection,
        isDisconnected: false,
        isReconnecting: true,
        status: "reconnecting",
      } as WalletConnectionSnapshot)
    ).toMatchObject({ status: "connecting" });
  });

  it("publishes unsupported state when the connected chain has no widget mapping", () => {
    expect(
      normalize({
        ...connected,
        chain: optimism,
        chainId: optimism.id,
      } as WalletConnectionSnapshot)
    ).toMatchObject({
      address,
      chain: optimism,
      connector,
      network: null,
      status: "unsupported",
    });
  });

  it("normalizes supported state, force address, chains, and auxiliary data", () => {
    const account = { id: "ledger-account" } as Account;
    const additionalAddresses = { cosmosPubKey: "A".repeat(44) };
    const state = normalize(connected, {
      additionalAddresses,
      forceAddress,
      ledgerState: {
        accounts: [account],
        currentAccountId: account.id,
        disabledChains: [],
      },
    });

    expect(state).toMatchObject({
      additionalAddresses,
      address: forceAddress,
      chain: mainnet,
      connector,
      connectorChains: [mainnet],
      isLedgerLiveAccountPlaceholder: false,
      ledgerAccounts: [account],
      network: "ethereum",
      status: "connected",
    });
  });

  it("recognizes Ledger mode and its no-account placeholder", () => {
    const ledgerConnector = {
      id: "ledgerLive",
      noAccountPlaceholder: "N/A",
    } as unknown as Connector;
    const state = normalize(
      {
        ...connected,
        address: "N/A",
        addresses: ["N/A"],
        connector: ledgerConnector,
      } as unknown as WalletConnectionSnapshot,
      { controller: { ...controller, isLedgerLive: true } }
    );

    expect(state).toMatchObject({
      isLedgerLive: true,
      isLedgerLiveAccountPlaceholder: true,
      status: "connected",
    });
  });

  it("projects command-identity overlays as connecting without treating Wagmi connected as settled", () => {
    const overlay = transitionalWalletState({
      additionalAddresses: null,
      connection: connected,
      connectorChains: [mainnet],
      controller,
      forceAddress: undefined,
      ledgerState: disconnectedLedgerConnectorState,
    });

    expect(overlay).toMatchObject({
      address,
      chain: mainnet,
      connector,
      network: "ethereum",
      status: "connecting",
    });
    expect(normalize(connected).status).toBe("connected");
  });
});
