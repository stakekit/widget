import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import { TokenAddress } from "../../src/domain/identity/identifiers";
import type { Token } from "../../src/domain/token/token";
import {
  buildExitReceiveTokensByAddress,
  equalExitReceiveTokenAddresses,
  projectExitReceiveTokenOption,
  resolveExitReceiveTokenAccessory,
  resolveExitReceiveTokenNote,
  resolvePositionDetailsExitReceiveTokenSelection,
} from "../../src/features/position-details/model/exit-receive-token";
import { yieldApiYieldDtoFixture, yieldApiYieldFixture } from "../fixtures";

const address = (value: string) => Schema.decodeSync(TokenAddress)(value);

const usdsAddress = address("0x1111111111111111111111111111111111111111");
const usdcAddress = address("0x2222222222222222222222222222222222222222");
const otherUsdcAddress = address("0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48");

const baseToken = yieldApiYieldDtoFixture().token as Token;

const usds: Token = {
  ...baseToken,
  address: usdsAddress,
  name: "USDS",
  symbol: "USDS",
};

const usdc: Token = {
  ...baseToken,
  address: usdcAddress,
  name: "USD Coin",
  symbol: "USDC",
};

describe("Exit receive token presentation", () => {
  it("uses a static position-token accessory when no receive selection exists", () => {
    expect(
      resolveExitReceiveTokenAccessory({
        positionToken: usds,
        selection: null,
      })
    ).toEqual({
      _tag: "Static",
      token: usds,
    });
  });

  it("uses a selectable receive-token accessory when multiple options exist", () => {
    expect(
      resolveExitReceiveTokenAccessory({
        positionToken: usds,
        selection: {
          options: [
            { address: usdsAddress, symbol: "USDS" },
            { address: usdcAddress, symbol: "USDC" },
          ],
          selected: { address: usdcAddress, symbol: "USDC" },
        },
        tokensByAddress: new Map([
          [usdsAddress.toLowerCase(), usds],
          [usdcAddress.toLowerCase(), usdc],
        ]),
      })
    ).toEqual({
      _tag: "Selectable",
      token: usdc,
    });
  });

  it("keeps a static receive-token accessory when only one option exists", () => {
    expect(
      resolveExitReceiveTokenAccessory({
        positionToken: usds,
        selection: {
          options: [{ address: usdcAddress, symbol: "USDC" }],
          selected: { address: usdcAddress, symbol: "USDC" },
        },
        tokensByAddress: new Map([[usdcAddress.toLowerCase(), usdc]]),
      })
    ).toEqual({
      _tag: "Static",
      token: usdc,
    });
  });

  it("omits the receive note when the selected receive token matches the position address", () => {
    expect(
      resolveExitReceiveTokenNote({
        positionToken: usds,
        selected: { address: usdsAddress, symbol: "USDS" },
      })
    ).toBeNull();
  });

  it("explains a different receive symbol without an address", () => {
    expect(
      resolveExitReceiveTokenNote({
        positionToken: usds,
        selected: { address: usdcAddress, symbol: "USDC" },
      })
    ).toEqual({
      symbol: "USDC",
      formattedAddress: null,
    });
  });

  it("includes a shortened address when the receive symbol matches but the contract differs", () => {
    expect(
      resolveExitReceiveTokenNote({
        positionToken: {
          ...usdc,
          address: usdcAddress,
        },
        selected: { address: otherUsdcAddress, symbol: "USDC" },
      })
    ).toEqual({
      symbol: "USDC",
      formattedAddress: "0xa0b8\u2026eb48",
    });
  });

  it("projects known tokens and stubs unknown receive options from the position token", () => {
    expect(
      projectExitReceiveTokenOption({
        option: { address: usdcAddress, symbol: "USDC" },
        positionToken: usds,
        tokensByAddress: new Map([[usdcAddress.toLowerCase(), usdc]]),
      })
    ).toEqual({
      address: usdcAddress,
      symbol: "USDC",
      formattedAddress: "0x2222\u20262222",
      token: usdc,
    });

    expect(
      projectExitReceiveTokenOption({
        option: { address: otherUsdcAddress, symbol: "USDC" },
        positionToken: usds,
        tokensByAddress: new Map(),
      })
    ).toEqual({
      address: otherUsdcAddress,
      symbol: "USDC",
      formattedAddress: "0xa0b8\u2026eb48",
      token: {
        ...usds,
        address: otherUsdcAddress,
        name: "USDC",
        symbol: "USDC",
        logoURI: undefined,
        coinGeckoId: undefined,
      },
    });
  });

  it("projects the native receive option from the gas fee token without an address", () => {
    const baseYield = yieldApiYieldDtoFixture();
    const nativeEth = baseYield.token as Token;
    const integration = yieldApiYieldFixture({
      inputTokens: [usdc],
      mechanics: { ...baseYield.mechanics, gasFeeToken: baseYield.token },
      outputToken: usds,
      token: usds,
      tokens: [usds],
    });

    expect(
      projectExitReceiveTokenOption({
        option: { address: address("0x"), symbol: "ETH" },
        positionToken: usds,
        tokensByAddress: buildExitReceiveTokensByAddress(integration),
      }).token
    ).toEqual(nativeEth);

    expect(
      projectExitReceiveTokenOption({
        option: { address: address("0x"), symbol: "ETH" },
        positionToken: usds,
        tokensByAddress: new Map(),
      }).token
    ).not.toHaveProperty("address");
  });

  const exitOutputTokenYield = ({
    options,
    tokens,
  }: {
    readonly options: ReadonlyArray<string>;
    readonly tokens: ReadonlyArray<Token>;
  }) => {
    const baseYield = yieldApiYieldDtoFixture();
    return yieldApiYieldFixture({
      inputTokens: [...tokens],
      mechanics: {
        ...baseYield.mechanics,
        arguments: {
          enter: { fields: [] },
          exit: {
            fields: [
              {
                label: "Output Token",
                name: "outputToken",
                options: [...options],
                required: true,
                type: "string",
              },
            ],
          },
        },
      },
      providerId: "other",
      token: tokens[0]!,
      tokens: [...tokens],
    });
  };

  it("keeps case-differing non-EVM receive options distinct", () => {
    const lowerAddress = address("So1anaMintAddressAAAAAAAAAAAAAAAAAAAAAAAAAA");
    const upperAddress = address("So1anaMintAddressaaaaaaaaaaaaaaaaaaaaaaaaaa");
    const lowerToken: Token = {
      ...baseToken,
      address: lowerAddress,
      name: "First Mint",
      network: "solana",
      symbol: "FIRST",
    };
    const upperToken: Token = {
      ...baseToken,
      address: upperAddress,
      name: "Second Mint",
      network: "solana",
      symbol: "SECOND",
    };
    const integration = exitOutputTokenYield({
      options: [lowerAddress, upperAddress],
      tokens: [lowerToken, upperToken],
    });
    const tokensByAddress = buildExitReceiveTokensByAddress(integration);

    const selection = resolvePositionDetailsExitReceiveTokenSelection({
      integration,
      selectedAddress: upperAddress,
    });

    expect(selection?.options).toEqual([
      { address: lowerAddress, symbol: "FIRST" },
      { address: upperAddress, symbol: "SECOND" },
    ]);
    expect(selection?.selected).toEqual({
      address: upperAddress,
      symbol: "SECOND",
    });
    expect(
      selection?.options.map(
        (option) =>
          projectExitReceiveTokenOption({
            option,
            positionToken: lowerToken,
            tokensByAddress,
          }).token
      )
    ).toEqual([lowerToken, upperToken]);
    expect(equalExitReceiveTokenAddresses(lowerAddress, upperAddress)).toBe(
      false
    );
  });

  it("matches EVM receive options across checksum and lowercase forms", () => {
    const checksumAddress = address(
      "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
    );
    const checksumUsdc: Token = { ...usdc, address: checksumAddress };
    const integration = exitOutputTokenYield({
      options: [usdsAddress, otherUsdcAddress],
      tokens: [usds, checksumUsdc],
    });

    const selection = resolvePositionDetailsExitReceiveTokenSelection({
      integration,
      selectedAddress: checksumAddress,
    });

    expect(selection?.selected).toEqual({
      address: otherUsdcAddress,
      symbol: "USDC",
    });
    expect(
      projectExitReceiveTokenOption({
        option: selection!.selected,
        positionToken: usds,
        tokensByAddress: buildExitReceiveTokensByAddress(integration),
      }).token
    ).toEqual(checksumUsdc);
    expect(
      equalExitReceiveTokenAddresses(checksumAddress, otherUsdcAddress)
    ).toBe(true);
  });
});
