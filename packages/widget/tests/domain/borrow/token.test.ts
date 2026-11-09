import * as Schema from "effect/Schema";
import { describe, expect, it } from "vitest";
import {
  BorrowToken,
  toBorrowNetworkToken,
} from "../../../src/domain/borrow/catalog/token";

const decodeBorrowToken = Schema.decodeUnknownSync(BorrowToken);

describe("toBorrowNetworkToken", () => {
  it("keeps the address and logo and carries the network", () => {
    const token = decodeBorrowToken({
      address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      decimals: 6,
      logoURI: "https://assets.example/usdc.png",
      name: "USD Coin",
      symbol: "USDC",
    });

    expect(toBorrowNetworkToken({ network: "base", token })).toEqual({
      address: token.address,
      decimals: 6,
      logoURI: "https://assets.example/usdc.png",
      name: "USD Coin",
      network: "base",
      symbol: "USDC",
    });
  });

  it("omits the address and logo when the Borrow token has none", () => {
    const token = decodeBorrowToken({
      decimals: 18,
      name: "Ether",
      symbol: "ETH",
    });

    const converted = toBorrowNetworkToken({ network: "ethereum", token });

    expect(converted).toEqual({
      decimals: 18,
      name: "Ether",
      network: "ethereum",
      symbol: "ETH",
    });
    expect("address" in converted).toBe(false);
    expect("logoURI" in converted).toBe(false);
  });
});
