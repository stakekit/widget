import { DateTime } from "effect";
import { HttpResponse, http } from "msw";
import type {
  ActionCommand,
  ManageActionCommand,
} from "../../src/domain/action/models";
import type { Token } from "../../src/domain/token/token";

import {
  yieldApiActionDtoFixture,
  yieldApiProviderFixture,
  yieldApiTransactionDtoFixture,
  yieldApiValidatorsFixture,
  yieldApiYieldDtoFixture,
  yieldBalanceFixture,
  yieldRiskSummaryFixture,
} from "../fixtures";
import { yieldApiRoute } from "./api-routes";
import { mockDelay } from "./delay";

const defaultToken: Token = {
  name: "Ethereum",
  symbol: "ETH",
  decimals: 18,
  network: "ethereum",
  coinGeckoId: "ethereum",
  logoURI: "https://assets.stakek.it/tokens/eth.svg",
};

const defaultYield = yieldApiYieldDtoFixture({
  id: "ethereum-eth-native-staking",
  token: defaultToken,
  tokens: [defaultToken],
  inputTokens: [defaultToken],
  outputToken: defaultToken,
  risk: yieldRiskSummaryFixture(),
});

const createDefaultAction = (
  body: ActionCommand | ManageActionCommand,
  type: "STAKE" | "UNSTAKE" | "CLAIM_REWARDS" = "STAKE"
) => {
  const transaction = yieldApiTransactionDtoFixture({
    id: "default-transaction-id",
    network: defaultToken.network,
    status: "CREATED",
    type,
  });

  return yieldApiActionDtoFixture({
    id: "default-action-id",
    yieldId: "yieldId" in body ? body.yieldId : defaultYield.id,
    type,
    address: body.address,
    amount: body.arguments?.amount ?? null,
    amountRaw: null,
    transactions: [transaction],
    rawArguments: body.arguments ?? null,
  });
};

const isoAt = (milliseconds: number) =>
  DateTime.formatIso(DateTime.makeUnsafe(milliseconds));

export const getYieldApiMock = () => [
  http.get(yieldApiRoute("/v1/networks"), async () => {
    await mockDelay();

    return HttpResponse.json([{ id: defaultToken.network }]);
  }),

  http.get(yieldApiRoute("/health"), async () => {
    await mockDelay();

    return HttpResponse.json({
      status: "OK",
      timestamp: isoAt(0),
    });
  }),

  http.get(yieldApiRoute("/v1/yields"), async () => {
    await mockDelay();

    return HttpResponse.json({
      items: [defaultYield],
      total: 1,
      limit: 20,
      offset: 0,
    });
  }),

  http.get(yieldApiRoute("/v1/tokens"), async ({ request }) => {
    await mockDelay();

    const url = new URL(request.url);
    const offset = Number(url.searchParams.get("offset") ?? 0);
    const limit = Number(url.searchParams.get("limit") ?? 100);
    const networks = url.searchParams
      .getAll("networks")
      .flatMap((value) => value.split(","));
    const yieldTypes = url.searchParams
      .getAll("yieldTypes")
      .flatMap((value) => value.split(","));
    const items =
      (networks.length === 0 || networks.includes(defaultToken.network)) &&
      (yieldTypes.length === 0 ||
        yieldTypes.includes(defaultYield.mechanics.type))
        ? [
            {
              token: defaultToken,
              availableYields: [defaultYield.id],
            },
          ]
        : [];

    return HttpResponse.json({
      items: items.slice(offset, offset + limit),
      total: items.length,
      limit,
      offset,
    });
  }),

  http.get(yieldApiRoute("/v1/yields/:yieldId"), async ({ params }) => {
    await mockDelay();

    return HttpResponse.json(
      yieldApiYieldDtoFixture({
        ...defaultYield,
        id: String(params.yieldId),
      })
    );
  }),

  http.get(yieldApiRoute("/v1/yields/:yieldId/kyc/status"), async () => {
    await mockDelay();

    return HttpResponse.json({
      kycStatus: "not_required",
    });
  }),

  http.get(yieldApiRoute("/v1/providers/:providerId"), async ({ params }) => {
    await mockDelay();
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
        logoURI: `https://assets.stakek.it/app/composition/providers/${providerId}.svg`,
        name: providerNameById[providerId] ?? providerId,
      })
    );
  }),

  http.get(yieldApiRoute("/v1/yields/:yieldId/validators"), async () => {
    await mockDelay();

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
      await mockDelay();

      return HttpResponse.json({
        yieldId: String(params.yieldId),
        total: 3,
        offset: 0,
        limit: 20,
        interval: "day",
        from: isoAt(0),
        to: isoAt(2 * 24 * 60 * 60 * 1000),
        items: [
          { timestamp: isoAt(0), rewardRate: "0.04" },
          {
            timestamp: isoAt(24 * 60 * 60 * 1000),
            rewardRate: "0.045",
          },
          {
            timestamp: isoAt(2 * 24 * 60 * 60 * 1000),
            rewardRate: "0.05",
          },
        ],
      });
    }
  ),

  http.get(
    yieldApiRoute("/v1/yields/:yieldId/tvl/history"),
    async ({ params }) => {
      await mockDelay();

      return HttpResponse.json({
        yieldId: String(params.yieldId),
        total: 3,
        offset: 0,
        limit: 20,
        interval: "day",
        from: isoAt(0),
        to: isoAt(2 * 24 * 60 * 60 * 1000),
        items: [
          { timestamp: isoAt(0), tvlUsd: "12000000" },
          {
            timestamp: isoAt(24 * 60 * 60 * 1000),
            tvlUsd: "12500000",
          },
          {
            timestamp: isoAt(2 * 24 * 60 * 60 * 1000),
            tvlUsd: "13100000",
          },
        ],
      });
    }
  ),

  http.post(yieldApiRoute("/v1/yields/balances"), async () => {
    await mockDelay();

    return HttpResponse.json({
      items: [],
      errors: [],
    });
  }),

  http.post(
    yieldApiRoute("/v1/yields/:yieldId/balances"),
    async ({ params }) => {
      await mockDelay();

      return HttpResponse.json({
        yieldId: String(params.yieldId),
        balances: [yieldBalanceFixture({ token: defaultToken })],
      });
    }
  ),

  http.post(yieldApiRoute("/v1/actions/enter"), async ({ request }) => {
    await mockDelay();

    return HttpResponse.json(
      createDefaultAction((await request.json()) as ActionCommand)
    );
  }),

  http.post(yieldApiRoute("/v1/actions/exit"), async ({ request }) => {
    await mockDelay();

    return HttpResponse.json(
      createDefaultAction((await request.json()) as ActionCommand, "UNSTAKE")
    );
  }),

  http.post(yieldApiRoute("/v1/actions/manage"), async ({ request }) => {
    await mockDelay();

    return HttpResponse.json(
      createDefaultAction(
        (await request.json()) as ManageActionCommand,
        "CLAIM_REWARDS"
      )
    );
  }),

  http.get(yieldApiRoute("/v1/actions"), async () => {
    await mockDelay();

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
      await mockDelay();

      return HttpResponse.json(
        yieldApiTransactionDtoFixture({
          id: String(params.transactionId),
        })
      );
    }
  ),

  http.post(
    yieldApiRoute("/v1/transactions/:transactionId/submit"),
    async ({ params }) => {
      await mockDelay();

      return HttpResponse.json(
        yieldApiTransactionDtoFixture({
          id: String(params.transactionId),
          status: "BROADCASTED",
        })
      );
    }
  ),

  http.put(
    yieldApiRoute("/v1/transactions/:transactionId/submit-hash"),
    async ({ params }) => {
      await mockDelay();

      return HttpResponse.json(
        yieldApiTransactionDtoFixture({
          id: String(params.transactionId),
          status: "BROADCASTED",
        })
      );
    }
  ),
];
