import { delay, HttpResponse, http } from "msw";
import type {
  YieldCreateActionDto,
  YieldCreateManageActionDto,
} from "../../src/domain/types/action";
import type { TokenDto } from "../../src/domain/types/tokens";
import {
  yieldApiActionFixture,
  yieldApiNetworkFixture,
  yieldApiProviderFixture,
  yieldApiTransactionFixture,
  yieldApiValidatorsFixture,
  yieldApiYieldFixture,
  yieldBalanceFixture,
  yieldRiskSummaryFixture,
} from "../fixtures";
import { yieldApiRoute } from "./api-routes";

const defaultToken: TokenDto = {
  name: "Ethereum",
  symbol: "ETH",
  decimals: 18,
  network: "ethereum",
  coinGeckoId: "ethereum",
  logoURI: "https://assets.stakek.it/tokens/eth.svg",
};

const defaultYield = yieldApiYieldFixture({
  id: "ethereum-eth-native-staking",
  token: defaultToken,
  tokens: [defaultToken],
  inputTokens: [defaultToken],
  outputToken: defaultToken,
  risk: yieldRiskSummaryFixture(),
});

const createDefaultAction = (
  body: YieldCreateActionDto | YieldCreateManageActionDto,
  type: "STAKE" | "UNSTAKE" | "CLAIM_REWARDS" = "STAKE"
) => {
  const transaction = yieldApiTransactionFixture({
    id: "default-transaction-id",
    network: defaultToken.network,
    status: "CREATED",
    type,
  });

  return yieldApiActionFixture({
    id: "default-action-id",
    yieldId: "yieldId" in body ? body.yieldId : defaultYield.id,
    type,
    address: body.address,
    amount: body.arguments?.amount ?? null,
    amountRaw: body.arguments?.amount ?? null,
    transactions: [transaction],
    rawArguments: body.arguments ?? null,
  });
};

export const getYieldApiMock = () => [
  http.get(yieldApiRoute("/health"), async () => {
    await delay();

    return HttpResponse.json({
      status: "OK",
      timestamp: new Date(0).toISOString(),
    });
  }),

  http.get(yieldApiRoute("/v1/networks"), async () => {
    await delay();

    return HttpResponse.json([
      yieldApiNetworkFixture({ id: defaultToken.network }),
    ]);
  }),

  http.get(yieldApiRoute("/v1/yields"), async () => {
    await delay();

    return HttpResponse.json({
      items: [defaultYield],
      total: 1,
      limit: 20,
      offset: 0,
    });
  }),

  http.get(yieldApiRoute("/v1/yields/:yieldId"), async ({ params }) => {
    await delay();

    return HttpResponse.json(
      yieldApiYieldFixture({
        ...defaultYield,
        id: String(params.yieldId),
      })
    );
  }),

  http.get(yieldApiRoute("/v1/yields/:yieldId/kyc/status"), async () => {
    await delay();

    return HttpResponse.json({
      kycStatus: "not_required",
    });
  }),

  http.get(yieldApiRoute("/v1/providers/:providerId"), async ({ params }) => {
    await delay();
    const providerId = String(params.providerId);
    const providerNameById: Record<string, string> = {
      benqi: "Benqi",
      stakekit: "StakeKit",
      stakewise: "Stakewise",
      trust: "Trust",
    };

    return HttpResponse.json(
      yieldApiProviderFixture({
        id: providerId,
        logoURI: `https://assets.stakek.it/providers/${providerId}.svg`,
        name: providerNameById[providerId] ?? providerId,
      })
    );
  }),

  http.get(yieldApiRoute("/v1/yields/:yieldId/validators"), async () => {
    await delay();

    return HttpResponse.json({
      items: yieldApiValidatorsFixture([]),
      total: 0,
      offset: 0,
      limit: 20,
    });
  }),

  http.get(
    yieldApiRoute("/v1/yields/:yieldId/reward-rate/history"),
    async ({ params }) => {
      await delay();

      return HttpResponse.json({
        yieldId: String(params.yieldId),
        total: 3,
        offset: 0,
        limit: 20,
        interval: "day",
        from: new Date(0).toISOString(),
        to: new Date(2 * 24 * 60 * 60 * 1000).toISOString(),
        items: [
          { timestamp: new Date(0).toISOString(), rewardRate: "0.04" },
          {
            timestamp: new Date(24 * 60 * 60 * 1000).toISOString(),
            rewardRate: "0.045",
          },
          {
            timestamp: new Date(2 * 24 * 60 * 60 * 1000).toISOString(),
            rewardRate: "0.05",
          },
        ],
      });
    }
  ),

  http.get(
    yieldApiRoute("/v1/yields/:yieldId/tvl/history"),
    async ({ params }) => {
      await delay();

      return HttpResponse.json({
        yieldId: String(params.yieldId),
        total: 3,
        offset: 0,
        limit: 20,
        interval: "day",
        from: new Date(0).toISOString(),
        to: new Date(2 * 24 * 60 * 60 * 1000).toISOString(),
        items: [
          { timestamp: new Date(0).toISOString(), tvlUsd: "12000000" },
          {
            timestamp: new Date(24 * 60 * 60 * 1000).toISOString(),
            tvlUsd: "12500000",
          },
          {
            timestamp: new Date(2 * 24 * 60 * 60 * 1000).toISOString(),
            tvlUsd: "13100000",
          },
        ],
      });
    }
  ),

  http.post(yieldApiRoute("/v1/yields/balances"), async () => {
    await delay();

    return HttpResponse.json({
      items: [],
      errors: [],
    });
  }),

  http.post(
    yieldApiRoute("/v1/yields/:yieldId/balances"),
    async ({ params }) => {
      await delay();

      return HttpResponse.json({
        yieldId: String(params.yieldId),
        balances: [yieldBalanceFixture({ token: defaultToken })],
      });
    }
  ),

  http.post(yieldApiRoute("/v1/actions/enter"), async ({ request }) => {
    await delay();

    return HttpResponse.json(
      createDefaultAction((await request.json()) as YieldCreateActionDto)
    );
  }),

  http.post(yieldApiRoute("/v1/actions/exit"), async ({ request }) => {
    await delay();

    return HttpResponse.json(
      createDefaultAction(
        (await request.json()) as YieldCreateActionDto,
        "UNSTAKE"
      )
    );
  }),

  http.post(yieldApiRoute("/v1/actions/manage"), async ({ request }) => {
    await delay();

    return HttpResponse.json(
      createDefaultAction(
        (await request.json()) as YieldCreateManageActionDto,
        "CLAIM_REWARDS"
      )
    );
  }),

  http.get(yieldApiRoute("/v1/actions"), async () => {
    await delay();

    return HttpResponse.json({
      items: [],
      total: 0,
      limit: 20,
      offset: 0,
    });
  }),

  http.get(
    yieldApiRoute("/v1/transactions/:transactionId"),
    async ({ params }) => {
      await delay();

      return HttpResponse.json(
        yieldApiTransactionFixture({
          id: String(params.transactionId),
        })
      );
    }
  ),

  http.post(
    yieldApiRoute("/v1/transactions/:transactionId/submit"),
    async ({ params }) => {
      await delay();

      return HttpResponse.json(
        yieldApiTransactionFixture({
          id: String(params.transactionId),
          status: "BROADCASTED",
        })
      );
    }
  ),

  http.put(
    yieldApiRoute("/v1/transactions/:transactionId/submit-hash"),
    async ({ params }) => {
      await delay();

      return HttpResponse.json(
        yieldApiTransactionFixture({
          id: String(params.transactionId),
          status: "BROADCASTED",
        })
      );
    }
  ),
];
