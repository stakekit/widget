import { Schema } from "effect";
import { base, mainnet, polygon } from "viem/chains";
import { describe, expect, it } from "vitest";
import type { Connector } from "wagmi";
import { WalletAddress } from "../../../src/domain/identity/identifiers";
import {
  type BorrowWalletView,
  projectBorrowWalletView,
} from "../../../src/features/borrow/wallet/model/wallet-view";
import {
  disconnectedNormalizedWalletState,
  type NormalizedWalletState,
} from "../../../src/services/wallet/wallet-state";

const address = Schema.decodeSync(WalletAddress)(
  "0x0000000000000000000000000000000000000001"
);

describe("Borrow wallet view", () => {
  const connector = {
    switchChain: async () => mainnet,
  } as unknown as Connector;
  const connectedWallet = {
    additionalAddresses: null,
    address,
    chain: mainnet,
    connector,
    connectorChains: [mainnet, base],
    isLedgerLive: false,
    isLedgerLiveAccountPlaceholder: false,
    ledgerAccounts: [],
    network: "ethereum",
    status: "connected",
  } satisfies NormalizedWalletState;
  const polygonWallet = {
    ...connectedWallet,
    chain: polygon,
    connectorChains: [polygon, mainnet, base],
    network: "polygon",
  } satisfies NormalizedWalletState;

  const expectStatus = (
    wallet: NormalizedWalletState,
    status: BorrowWalletView["status"]
  ) => {
    expect(projectBorrowWalletView(wallet)).toEqual({ status });
  };

  it("reports a connected wallet on a supported Borrow network as ready", () => {
    expectStatus(connectedWallet, "ready");
  });

  it("requires a connection while the wallet is disconnected", () => {
    expectStatus(
      {
        ...disconnectedNormalizedWalletState,
        connectorChains: [mainnet, base],
      },
      "connection-required"
    );
  });

  it("waits instead of asking for a connection while the wallet switches chains", () => {
    expectStatus({ ...polygonWallet, status: "connecting" }, "connecting");
    expectStatus(
      {
        ...disconnectedNormalizedWalletState,
        connectorChains: [mainnet, base],
        status: "connecting",
      },
      "connecting"
    );
  });

  it("offers the wallet's Borrow chains to an unsupported wallet that can switch", () => {
    expect(
      projectBorrowWalletView({
        ...disconnectedNormalizedWalletState,
        address,
        chain: polygon,
        connector,
        connectorChains: [polygon, mainnet, base],
        status: "unsupported",
      })
    ).toEqual({
      recovery: { _tag: "SwitchChain", chains: [mainnet, base] },
      status: "unsupported-network",
    });
  });

  it("offers the host's initial chain first when it is a Borrow chain", () => {
    expect(projectBorrowWalletView(polygonWallet, base.id)).toEqual({
      recovery: { _tag: "SwitchChain", chains: [base, mainnet] },
      status: "unsupported-network",
    });
  });

  it("reports a connected wallet whose network and chain disagree as unsupported", () => {
    expect(
      projectBorrowWalletView({ ...connectedWallet, network: "base" })
    ).toEqual({
      recovery: { _tag: "SwitchChain", chains: [mainnet, base] },
      status: "unsupported-network",
    });
  });

  it("asks for a manual switch when the wallet connector cannot switch chains", () => {
    expect(
      projectBorrowWalletView({
        ...polygonWallet,
        connector: {} as Connector,
      })
    ).toEqual({
      recovery: { _tag: "SwitchManually", chains: [mainnet, base] },
      status: "unsupported-network",
    });
  });

  it("reports Borrow as unavailable when the wallet has no Borrow chain", () => {
    expect(
      projectBorrowWalletView({ ...polygonWallet, connectorChains: [polygon] })
    ).toEqual({
      recovery: { _tag: "Unavailable" },
      status: "unsupported-network",
    });
  });

  it("asks an unsupported wallet without a connector to connect again", () => {
    expect(
      projectBorrowWalletView({
        ...disconnectedNormalizedWalletState,
        connectorChains: [mainnet, base],
        status: "unsupported",
      })
    ).toEqual({
      recovery: { _tag: "Connect" },
      status: "unsupported-network",
    });
  });
});
