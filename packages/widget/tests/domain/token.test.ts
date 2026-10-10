import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import { equalTokens, Token, tokenString } from "../../src/domain/token/token";

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
        { network: "ethereum", symbol: "ETH", address: "" }
      )
    ).toBe(false);
  });
});
