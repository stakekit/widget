import { Schema } from "effect";
import { base, mainnet } from "viem/chains";
import { describe, expect, it } from "vitest";
import type { Connector } from "wagmi";
import { WalletAddress } from "../../src/domain/schema/identifiers";
import { toBorrowWalletStateProjection } from "../../src/services/borrow/wallet-state-projection";
import type { NormalizedWalletState } from "../../src/services/wallet/domain/state";

const address = Schema.decodeSync(WalletAddress)(
  "0x0000000000000000000000000000000000000001"
);

describe("borrow wallet bridge", () => {
  it("purely projects atom-owned wallet state", () => {
    const connector = {} as Connector;
    const wallet = {
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
    const projection = toBorrowWalletStateProjection(wallet);

    expect(projection).toMatchObject({
      status: "connected",
      wallet: {
        currentAccount: { address },
        network: "ethereum",
      },
    });
  });
});
