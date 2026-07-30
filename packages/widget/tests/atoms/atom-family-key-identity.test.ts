import { Equal, Schema } from "effect";
import type { Chain } from "viem";
import { describe, expect, it } from "vitest";
import type { Connector } from "wagmi";
import { WalletAddress, YieldId } from "../../src/domain/schema/identifiers";
import { earnYieldCatalogAtom } from "../../src/features/earn/state/earn-selection/resources/atoms";
import {
  TokenYieldScopeKey,
  YieldCatalogKey,
} from "../../src/features/earn/state/earn-selection/resources/keys";
import {
  CurrentRewardsSummaryKey,
  positiveRewardsSummaryAtom,
} from "../../src/features/yield-summary/state/yield-insights";
import {
  ActivityInvalidationKey,
  BorrowMarketsInvalidationKey,
  WalletBalancesInvalidationKey,
} from "../../src/services/resource-invalidation";
import {
  sameWalletScopeOwner,
  WalletScopeKey,
  walletScopeFromState,
} from "../../src/services/wallet/domain/scope";
import type { NormalizedWalletState } from "../../src/services/wallet/domain/state";
import { disconnectedNormalizedWalletState } from "../../src/services/wallet/domain/state";

const firstYieldId = Schema.decodeSync(YieldId)("yield-a");
const secondYieldId = Schema.decodeSync(YieldId)("yield-b");
const firstAddress = Schema.decodeSync(WalletAddress)("0xwallet-a");
const secondAddress = Schema.decodeSync(WalletAddress)("0xwallet-b");

const connectedWalletState = ({
  additionalAddresses = null,
  address = firstAddress,
}: Pick<
  Extract<NormalizedWalletState, { readonly status: "connected" }>,
  "additionalAddresses" | "address"
>): NormalizedWalletState => ({
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

describe("atom family key identity", () => {
  it("canonicalizes unordered reward identifiers before family selection", () => {
    const first = new CurrentRewardsSummaryKey({
      yieldIds: [secondYieldId, firstYieldId, secondYieldId],
    });
    const equivalent = new CurrentRewardsSummaryKey({
      yieldIds: [firstYieldId, secondYieldId],
    });

    expect(first.yieldIds).toEqual([firstYieldId, secondYieldId]);
    expect(positiveRewardsSummaryAtom(first)).toBe(
      positiveRewardsSummaryAtom(equivalent)
    );
  });

  it("canonicalizes unordered catalog identifiers before family selection", () => {
    const first = new YieldCatalogKey({
      category: null,
      network: "ethereum",
      yieldIds: [secondYieldId, firstYieldId, secondYieldId],
    });
    const equivalent = new YieldCatalogKey({
      category: null,
      network: "ethereum",
      yieldIds: [firstYieldId, secondYieldId],
    });

    expect(first.yieldIds).toEqual([firstYieldId, secondYieldId]);
    expect(earnYieldCatalogAtom(first)).toBe(earnYieldCatalogAtom(equivalent));
  });

  it("uses value-equal scope keys for companion state", () => {
    const first = new TokenYieldScopeKey({
      category: "stake",
      yieldIds: [secondYieldId, firstYieldId, secondYieldId],
    });
    const equivalent = new TokenYieldScopeKey({
      category: "stake",
      yieldIds: [firstYieldId, secondYieldId],
    });

    expect(Equal.equals(first, equivalent)).toBe(true);
  });

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

  it("derives connected wallet scope and represents disconnection as null", () => {
    const connected = connectedWalletState({
      additionalAddresses: null,
      address: firstAddress,
    });
    const disconnected: NormalizedWalletState =
      disconnectedNormalizedWalletState;

    expect(
      Equal.equals(
        walletScopeFromState(connected),
        new WalletScopeKey({
          additionalAddresses: null,
          address: firstAddress,
          network: "ethereum",
        })
      )
    ).toBe(true);
    expect(walletScopeFromState(disconnected)).toBeNull();
  });

  it("uses value equality for semantic invalidation categories", () => {
    const firstScope = new WalletScopeKey({
      address: firstAddress,
      network: "ethereum",
    });
    const equivalentScope = new WalletScopeKey({
      additionalAddresses: null,
      address: firstAddress,
      network: "ethereum",
    });

    expect(
      Equal.equals(
        new WalletBalancesInvalidationKey({ scope: firstScope }),
        new WalletBalancesInvalidationKey({ scope: equivalentScope })
      )
    ).toBe(true);
    expect(
      Equal.equals(
        new ActivityInvalidationKey({ scope: firstScope }),
        new WalletBalancesInvalidationKey({ scope: firstScope })
      )
    ).toBe(false);
    expect(
      Equal.equals(
        new BorrowMarketsInvalidationKey({ network: "ethereum" }),
        new BorrowMarketsInvalidationKey({ network: "ethereum" })
      )
    ).toBe(true);
  });
});
