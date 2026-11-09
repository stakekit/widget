import { HttpResponse, http } from "msw";
import type { TokenDto } from "../generated/legacy-api-types";
import { legacyApiRoute } from "./api-routes";
import { mockDelay } from "./delay";

const defaultToken: TokenDto = {
  name: "Ethereum",
  symbol: "ETH",
  decimals: 18,
  network: "ethereum",
  coinGeckoId: "ethereum",
  logoURI: "https://assets.stakek.it/tokens/eth.svg",
};

const defaultYieldId = "ethereum-eth-native-staking";

export const getLegacyApiMock = () => [
  http.get(legacyApiRoute("/v1/tokens"), async () => {
    await mockDelay();

    return HttpResponse.json([
      {
        token: defaultToken,
        availableYields: [defaultYieldId],
      },
    ]);
  }),

  http.get(
    legacyApiRoute("/v2/networks/:network/addresses/:address/tokens"),
    async () => {
      await mockDelay();

      return HttpResponse.json([
        {
          token: defaultToken,
          amount: "0",
          availableYields: [defaultYieldId],
        },
      ]);
    }
  ),

  http.post(legacyApiRoute("/v1/tokens/balances"), async () => {
    await mockDelay();

    return HttpResponse.json([
      { token: defaultToken, amount: "0", availableYields: [defaultYieldId] },
    ]);
  }),

  http.post(legacyApiRoute("/v1/tokens/prices"), async () => {
    await mockDelay();

    return HttpResponse.json({
      "ethereum-": {
        price: 1,
        price_24_h: 0,
      },
    });
  }),
];
