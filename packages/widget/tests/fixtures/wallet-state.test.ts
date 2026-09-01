import { describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";
import { WalletAddress } from "../../src/domain/identity/identifiers";
import { WalletScopeKey } from "../../src/domain/wallet/wallet-scope";
import {
  makeConnectedWalletState,
  makeConnectingWalletState,
  makeDisconnectedWalletState,
} from "./wallet-state";

const scope = new WalletScopeKey({
  address: Schema.decodeSync(WalletAddress)(
    "0x0000000000000000000000000000000000000001"
  ),
  network: "ethereum",
});

describe("wallet-state fixtures", () => {
  it("builds fresh connected Wallet State for a Wallet Scope", () => {
    const first = makeConnectedWalletState(scope);
    const second = makeConnectedWalletState(scope);

    expect(first).toMatchObject({
      connection: {
        additionalAddresses: null,
        address: scope.address,
        isLedgerLive: false,
        network: scope.network,
        status: "connected",
      },
      ledger: {
        accounts: [],
        currentAccountId: undefined,
        disabledChains: [],
      },
    });
    expect(first).not.toBe(second);
    expect(first.connection.connectorChains).not.toBe(
      second.connection.connectorChains
    );
    expect(first.ledger.accounts).not.toBe(second.ledger.accounts);
  });

  it("builds narrow connecting and disconnected Wallet State", () => {
    const connecting = makeConnectingWalletState(scope);
    const disconnected = makeDisconnectedWalletState();

    expect(connecting.connection.status).toBe("connecting");
    expect(connecting.connection.address).toBe(scope.address);
    expect(connecting.connection.network).toBe(scope.network);
    expect(disconnected.connection.status).toBe("disconnected");
    expect(disconnected.ledger.accounts).toEqual([]);
  });
});
