import BigNumber from "bignumber.js";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import {
  TokenAddress,
  WalletAddress,
} from "../../src/domain/identity/identifiers";
import type { Token } from "../../src/domain/token/token";
import { projectYieldEntry } from "../../src/features/yield-entry/model/yield-entry";
import { yieldApiYieldFixture } from "../fixtures";

const address = Schema.decodeSync(WalletAddress)(
  "0x1234567890123456789012345678901234567890"
);

const projectEnterArguments = (token: Token) => {
  const selectedYield = yieldApiYieldFixture();
  const view = projectYieldEntry({
    input: {
      additionalValidationErrors: undefined,
      amountInitialization: "PreserveIntent",
      availableAmount: new BigNumber("1"),
      connected: true,
      entry: {
        amount: new BigNumber("1"),
        selectedProviderOption: null,
        token,
        tronResource: null,
        useMaxAmount: false,
        validators: new Map(),
        yield: selectedYield,
      },
      externalProviders: false,
      hasNoYields: false,
      isKycBlocking: false,
      isKycLoading: false,
      isLedgerAccountPlaceholder: false,
      readiness: { _tag: "Ready" },
      selectedYieldHasActivePosition: false,
      providers: null,
      validateAmount: true,
      wallet: { additionalAddresses: null, address, isLedgerLive: false },
    },
    submitted: false,
  });

  return view.preparation?.command.arguments;
};

describe("Enter input token", () => {
  it("sends the native token placeholder when the selected token has no address", () => {
    const native: Token = {
      name: "Ethereum",
      symbol: "ETH",
      decimals: 18,
      network: "ethereum",
    };

    expect(projectEnterArguments(native)?.inputToken).toBe("0x");
  });

  it("sends the token address when the selected token has one", () => {
    const eEth: Token = {
      name: "ether.fi ETH",
      symbol: "eETH",
      decimals: 18,
      network: "ethereum",
      address: Schema.decodeSync(TokenAddress)(
        "0x35fA164735182de50811E8e2E824cFb9B6118ac2"
      ),
    };

    expect(projectEnterArguments(eEth)?.inputToken).toBe(
      "0x35fA164735182de50811E8e2E824cFb9B6118ac2"
    );
  });
});
