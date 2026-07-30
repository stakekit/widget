import { HttpResponse, http } from "msw";
import type {
  TokenDto,
  YieldRewardsSummaryResponseDto,
} from "../../src/generated/api/legacy";
import { legacyYieldFixture } from "../fixtures";
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

const defaultYield = legacyYieldFixture({
  id: "ethereum-eth-native-staking",
  token: defaultToken,
  tokens: [defaultToken],
  validators: [],
});

export const getLegacyApiMock = () => [
  http.get(legacyApiRoute("/v1/yields/enabled/networks"), async () => {
    await mockDelay();

    return HttpResponse.json([defaultToken.network]);
  }),

  http.get(legacyApiRoute("/v1/tokens"), async () => {
    await mockDelay();

    return HttpResponse.json([
      {
        token: defaultToken,
        availableYields: [defaultYield.id],
      },
    ]);
  }),

  http.post(legacyApiRoute("/v1/tokens/balances/scan"), async () => {
    await mockDelay();

    return HttpResponse.json([
      {
        token: defaultToken,
        amount: "0",
        availableYields: [defaultYield.id],
      },
    ]);
  }),

  http.post(legacyApiRoute("/v1/tokens/balances"), async () => {
    await mockDelay();

    return HttpResponse.json([
      { token: defaultToken, amount: "0", availableYields: [defaultYield.id] },
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

  http.get(legacyApiRoute("/v1/yields/:integrationId"), async ({ params }) => {
    await mockDelay();

    return HttpResponse.json(
      legacyYieldFixture({
        ...defaultYield,
        id: String(params.integrationId),
      })
    );
  }),

  http.post(
    legacyApiRoute("/v1/yields/:integrationId/rewards-summary"),
    async () => {
      await mockDelay();

      return HttpResponse.json({
        rewards: {
          total: "0",
          last24H: "0",
          last7D: "0",
          last30D: "0",
          lastYear: "0",
        },
        token: defaultToken,
      } satisfies YieldRewardsSummaryResponseDto);
    }
  ),

  http.post(
    legacyApiRoute("/v1/transactions/verification/:network"),
    async () => {
      await mockDelay();

      return HttpResponse.json({ message: "verification-message" });
    }
  ),
];
