import { Schema } from "effect";
import { base, mainnet } from "viem/chains";
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
  const connector = {} as Connector;
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

  const expectStatus = (
    wallet: NormalizedWalletState,
    status: BorrowWalletView["status"]
  ) => {
    expect(projectBorrowWalletView(wallet)).toEqual({ status });
  };

  it("reports a connected wallet on a supported Borrow network as ready", () => {
    expectStatus(connectedWallet, "ready");
  });

  it.each(["disconnected", "connecting"] as const)(
    "requires a connection while the wallet is %s",
    (status) => {
      expectStatus(
        {
          ...disconnectedNormalizedWalletState,
          connectorChains: [mainnet, base],
          status,
        },
        "connection-required"
      );
    }
  );

  it("reports an authoritative unsupported wallet as unsupported", () => {
    expectStatus(
      {
        ...disconnectedNormalizedWalletState,
        connectorChains: [mainnet, base],
        status: "unsupported",
      },
      "unsupported-network"
    );
  });

  it("reports a connected wallet whose network and chain disagree as unsupported", () => {
    expectStatus(
      { ...connectedWallet, network: "base" },
      "unsupported-network"
    );
  });
});
