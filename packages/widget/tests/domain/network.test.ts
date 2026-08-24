import { describe, expect, expectTypeOf, it } from "vitest";
import type { BorrowNetwork } from "../../src/domain/borrow/network";
import { intersectNetworkLiterals } from "../../src/domain/network/intersection";
import { isEvmNetwork, type Network } from "../../src/domain/network/network";
import type { WalletNetwork } from "../../src/domain/wallet/network";
import {
  isCosmosWalletNetwork,
  isEvmWalletNetwork,
  isWalletNetwork,
} from "../../src/domain/wallet/network";
import type { SKNetwork } from "../../src/public-api/types";

describe("Network", () => {
  it("contains only network identities declared by both backends", () => {
    expect(
      intersectNetworkLiterals(
        ["ethereum", "legacy-only", "shared"],
        ["yield-only", "shared", "ethereum"]
      )
    ).toEqual(["ethereum", "shared"]);
  });

  it("rejects an empty backend intersection", () => {
    expect(() =>
      intersectNetworkLiterals(["legacy-only"], ["yield-only"])
    ).toThrow("Legacy and Yield Networks have no shared values");
  });

  it("matches the private public transaction Network contract", () => {
    expectTypeOf<Network>().toEqualTypeOf<SKNetwork>();
  });

  it("limits Borrow Networks to Wallet Networks", () => {
    expectTypeOf<BorrowNetwork>().toMatchTypeOf<WalletNetwork>();
  });

  it("distinguishes Wallet Networks from other common Networks", () => {
    expect(isWalletNetwork("ethereum")).toBe(true);
    expect(isWalletNetwork("cosmos")).toBe(true);
    expect(isWalletNetwork("cardano")).toBe(true);
    expect(isWalletNetwork("bittensor")).toBe(true);
    expect(isWalletNetwork("robinhood")).toBe(true);
    expect(isWalletNetwork("robinhood-testnet")).toBe(true);
    expect(isWalletNetwork("plume")).toBe(false);
    expect(isWalletNetwork("not-a-network")).toBe(false);
  });

  it("classifies wallet ecosystems without admitting non-wallet Networks", () => {
    expect(isEvmWalletNetwork("ethereum")).toBe(true);
    expect(isEvmWalletNetwork("robinhood")).toBe(true);
    expect(isEvmWalletNetwork("robinhood-testnet")).toBe(true);
    expect(isEvmWalletNetwork("plume")).toBe(false);
    expect(isCosmosWalletNetwork("cosmos")).toBe(true);
    expect(isCosmosWalletNetwork("evmos")).toBe(false);
  });

  it("derives EVM classification from the generated Legacy schema", () => {
    expect(isEvmNetwork("ethereum")).toBe(true);
    expect(isEvmNetwork("plume")).toBe(true);
    expect(isEvmNetwork("cosmos")).toBe(false);
  });
});
