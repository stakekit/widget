import { Schema } from "effect";
import { describe, expect, expectTypeOf, it } from "vitest";
import {
  equalTokens,
  type HostTokenKey,
  hostTokenKey,
  Token,
  type TokenString,
  tokenString,
} from "../../../src/domain/token/token";

const token = (overrides: Partial<typeof Token.Encoded> = {}) =>
  Schema.decodeSync(Token)({
    name: "USD Coin",
    symbol: "USDC",
    decimals: 6,
    network: "ethereum",
    address: "0xAbCd",
    ...overrides,
  });

describe("Token", () => {
  it("uses network, exact symbol, and case-insensitive hex address as identity", () => {
    expect(tokenString(token())).toBe("ethereum-USDC-0xabcd");
    expect(equalTokens(token(), token({ address: "0xabCD" }))).toBe(true);
    expect(
      equalTokens(
        token({ network: "zksync", address: "0xAbCd" }),
        token({ network: "zksync", address: "0xabCD" })
      )
    ).toBe(true);
    expect(equalTokens(token(), token({ symbol: "usdc" }))).toBe(false);
  });

  it("preserves non-hex address case and distinguishes a missing address", () => {
    const solana = token({ network: "solana", address: "AbCd" });

    expect(
      equalTokens(solana, token({ network: "solana", address: "abcd" }))
    ).toBe(false);
    expect(
      equalTokens(
        { network: "ethereum", symbol: "ETH" },
        token({ network: "ethereum", symbol: "ETH", address: "0x" })
      )
    ).toBe(false);
  });

  it("keys host references by network and address, ignoring symbol and case", () => {
    expect(hostTokenKey(token())).toBe("ethereum-0xabcd");
    expect(hostTokenKey(token({ symbol: "USDC.e" }))).toBe(
      hostTokenKey(token())
    );
    expect(hostTokenKey({ network: "ethereum" })).toBe("ethereum-");
  });

  it("keeps internal token identities out of host-keyed lookups", () => {
    expectTypeOf<TokenString>().not.toMatchTypeOf<HostTokenKey>();
    expectTypeOf<HostTokenKey>().not.toMatchTypeOf<TokenString>();
  });
});
