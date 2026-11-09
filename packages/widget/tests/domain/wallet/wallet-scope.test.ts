import { Equal, Schema } from "effect";
import type { Chain } from "viem";
import { describe, expect, it } from "vitest";
import type { Connector } from "wagmi";

import { WalletAddress } from "../../../src/domain/identity/identifiers";
import {
  sameWalletScopeOwner,
  WalletScopeKey,
} from "../../../src/domain/wallet/wallet-scope";
import { walletScopeFromState } from "../../../src/services/wallet/wallet-scope-adapter";
import type { NormalizedWalletState } from "../../../src/services/wallet/wallet-state";
import { disconnectedNormalizedWalletState } from "../../../src/services/wallet/wallet-state";

const firstAddress = Schema.decodeSync(WalletAddress)("0xwallet-a");
const secondAddress = Schema.decodeSync(WalletAddress)("0xwallet-b");

const connectedWalletState = ({
  additionalAddresses,
  address,
}: Pick<
  Extract<NormalizedWalletState, { readonly status: "connected" }>,
  "additionalAddresses" | "address"
>): Extract<NormalizedWalletState, { readonly status: "connected" }> => ({
  additionalAddresses,
  address,
  chain: {} as Chain,
  connector: {} as Connector,
  connectorChains: [],
  isLedgerLive: false,
  isLedgerLiveAccountPlaceholder: false,
  ledgerAccounts: [],
  network: "ethereum",
  status: "connected",
});

describe("Wallet Scope identity", () => {
  it("normalizes reconstructed wallet scope values", () => {
    const first = new WalletScopeKey({
      additionalAddresses: null,
      address: firstAddress,
      network: "ethereum",
    });
    const equivalent = new WalletScopeKey({
      address: firstAddress,
      network: "ethereum",
    });

    expect(first.additionalAddresses).toBeNull();
    expect(Equal.equals(first, equivalent)).toBe(true);
  });

  it("normalizes logically equivalent additional-address collections", () => {
    const first = new WalletScopeKey({
      additionalAddresses: {
        lidoStakeAccounts: ["lido-b", "lido-a", "lido-a"],
        stakeAccounts: ["stake-b", "stake-a"],
      },
      address: firstAddress,
      network: "solana",
    });
    const equivalent = new WalletScopeKey({
      additionalAddresses: {
        lidoStakeAccounts: ["lido-a", "lido-b"],
        stakeAccounts: ["stake-a", "stake-b"],
      },
      address: firstAddress,
      network: "solana",
    });

    expect(Equal.equals(first, equivalent)).toBe(true);
  });

  it("changes wallet scope identity with network, address, or additional addresses", () => {
    const base = new WalletScopeKey({
      additionalAddresses: null,
      address: firstAddress,
      network: "ethereum",
    });

    expect(
      Equal.equals(
        base,
        new WalletScopeKey({
          additionalAddresses: null,
          address: secondAddress,
          network: "ethereum",
        })
      )
    ).toBe(false);
    expect(
      Equal.equals(
        base,
        new WalletScopeKey({
          additionalAddresses: null,
          address: firstAddress,
          network: "polygon",
        })
      )
    ).toBe(false);
    expect(
      Equal.equals(
        base,
        new WalletScopeKey({
          additionalAddresses: { binanceBeaconAddress: "bnb-address" },
          address: firstAddress,
          network: "ethereum",
        })
      )
    ).toBe(false);
  });

  it("compares wallet ownership by network and network-aware address only", () => {
    const evmOwner = new WalletScopeKey({
      additionalAddresses: null,
      address: Schema.decodeSync(WalletAddress)(
        "0x00000000000000000000000000000000000000ab"
      ),
      network: "ethereum",
    });
    const sameEvmOwner = new WalletScopeKey({
      additionalAddresses: { binanceBeaconAddress: "bnb-address" },
      address: Schema.decodeSync(WalletAddress)(
        "0x00000000000000000000000000000000000000AB"
      ),
      network: "ethereum",
    });
    const solanaOwner = new WalletScopeKey({
      address: Schema.decodeSync(WalletAddress)("SolanaWalletA"),
      network: "solana",
    });
    const caseDistinctSolanaOwner = new WalletScopeKey({
      address: Schema.decodeSync(WalletAddress)("solanawalleta"),
      network: "solana",
    });

    expect(sameWalletScopeOwner(evmOwner, sameEvmOwner)).toBe(true);
    expect(
      sameWalletScopeOwner(
        evmOwner,
        new WalletScopeKey({
          address: evmOwner.address,
          network: "base",
        })
      )
    ).toBe(false);
    expect(sameWalletScopeOwner(solanaOwner, caseDistinctSolanaOwner)).toBe(
      false
    );
  });

  it("derives Wallet Scope from an available owner and represents disconnection as null", () => {
    const connected = connectedWalletState({
      additionalAddresses: null,
      address: firstAddress,
    });
    const connecting: NormalizedWalletState = {
      ...connected,
      status: "connecting",
    };
    const disconnected: NormalizedWalletState =
      disconnectedNormalizedWalletState;

    const expected = new WalletScopeKey({
      additionalAddresses: null,
      address: firstAddress,
      network: "ethereum",
    });
    expect(Equal.equals(walletScopeFromState(connected), expected)).toBe(true);
    expect(Equal.equals(walletScopeFromState(connecting), expected)).toBe(true);
    expect(walletScopeFromState(disconnected)).toBeNull();
  });
});
