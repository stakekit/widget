import { describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { type Connector, createConfig, http } from "wagmi";
import { mainnet } from "wagmi/chains";
import { mock } from "wagmi/connectors";

import { WalletAddress } from "../../../src/domain/identity/identifiers";
import { connectedWalletAtom } from "../../../src/features/wallet/state/connected-wallet";
import { walletStateResultAtom } from "../../../src/features/wallet/state/root-atom";
import { externalProviderConnectorId } from "../../../src/services/wallet/external-provider-connector-id";
import {
  disconnectedNormalizedWalletState,
  type NormalizedWalletState,
} from "../../../src/services/wallet/wallet-state";

const rawAddress = "0x1111111111111111111111111111111111111111";
const config = createConfig({
  chains: [mainnet],
  connectors: [mock({ accounts: [rawAddress] })],
  transports: { [mainnet.id]: http() },
  storage: null,
  multiInjectedProviderDiscovery: false,
});
const [mockConnector] = config.connectors;

const connectedThrough = (connector: Connector): NormalizedWalletState => ({
  status: "connected",
  address: Schema.decodeSync(WalletAddress)(rawAddress),
  additionalAddresses: null,
  chain: mainnet,
  connector,
  connectorChains: [mainnet],
  network: "ethereum",
  isLedgerLive: false,
  isLedgerLiveAccountPlaceholder: false,
  ledgerAccounts: [],
});

const readConnectedWallet = (connection: NormalizedWalletState) =>
  AtomRegistry.make({
    initialValues: [[walletStateResultAtom, AsyncResult.success(connection)]],
  }).get(connectedWalletAtom);

describe("connectedWalletAtom", () => {
  it("names the connector and carries its icon as the logo", () => {
    if (!mockConnector) throw new Error("Expected the mock connector");

    expect(
      readConnectedWallet(
        connectedThrough({ ...mockConnector, icon: "data:image/png;base64,x" })
      )
    ).toEqual({ name: mockConnector.name, logo: "data:image/png;base64,x" });
    expect(readConnectedWallet(connectedThrough(mockConnector))).toEqual({
      name: mockConnector.name,
    });
  });

  it("names no wallet for the host's External Provider or without a connector", () => {
    if (!mockConnector) throw new Error("Expected the mock connector");

    expect(
      readConnectedWallet(
        connectedThrough({ ...mockConnector, id: externalProviderConnectorId })
      )
    ).toBeNull();
    expect(readConnectedWallet(disconnectedNormalizedWalletState)).toBeNull();
  });
});
