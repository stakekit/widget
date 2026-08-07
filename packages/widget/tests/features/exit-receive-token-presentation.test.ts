import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import { TokenAddress } from "../../src/domain/schema/identifiers";
import type { AppToken } from "../../src/domain/schema/legacy-models";
import {
  projectExitReceiveTokenOption,
  resolveExitReceiveTokenAccessory,
  resolveExitReceiveTokenNote,
} from "../../src/features/position-details/model/exit-receive-token";
import { yieldApiYieldDtoFixture } from "../fixtures";

const address = (value: string) => Schema.decodeSync(TokenAddress)(value);

const usdsAddress = address("0x1111111111111111111111111111111111111111");
const usdcAddress = address("0x2222222222222222222222222222222222222222");
const otherUsdcAddress = address("0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48");

const baseToken = yieldApiYieldDtoFixture().token as AppToken;

const usds: AppToken = {
  ...baseToken,
  address: usdsAddress,
  name: "USDS",
  symbol: "USDS",
};

const usdc: AppToken = {
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
});
