import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import {
  TokenAddress,
  WalletAddress,
} from "../../../src/domain/identity/identifiers";
import { WalletScopeKey } from "../../../src/domain/wallet/wallet-scope";
import { walletScopeGasTokenBalancesKey } from "../../../src/resources/gas-token-balances/gas-token-balances";

const address = Schema.decodeSync(WalletAddress)(
  "0x1234567890123456789012345678901234567890"
);
const usdc = Schema.decodeSync(TokenAddress)(
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
);
const scope = new WalletScopeKey({
  additionalAddresses: null,
  address,
  network: "ethereum",
});

describe("Gas Token Balances key", () => {
  it("reads the native token of the Wallet Scope's own network by default", () => {
    expect(walletScopeGasTokenBalancesKey(scope).command.addresses).toEqual([
      { address, network: "ethereum" },
    ]);
  });

  it("reads the gas token on its own network, even when it is not the scope's", () => {
    expect(
      walletScopeGasTokenBalancesKey(scope, {
        address: usdc,
        network: "base",
      }).command.addresses
    ).toEqual([{ address, network: "base", tokenAddress: usdc }]);
  });

  it("keys the same scope and token to the same balance read", () => {
    expect(walletScopeGasTokenBalancesKey(scope)).toEqual(
      walletScopeGasTokenBalancesKey(
        new WalletScopeKey({
          additionalAddresses: null,
          address,
          network: "ethereum",
        })
      )
    );
  });
});
