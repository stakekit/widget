import { delay, HttpResponse, http } from "msw";
import { vitest } from "vitest";
import type { YieldCreateActionDto } from "../../../src/domain/types/action";
import { waitForMs } from "../../../src/utils";
import {
  legacyYieldFixture,
  yieldApiActionFixture,
  yieldApiTransactionFixture,
  yieldApiValidatorsFixture,
  yieldApiYieldFixture,
} from "../../fixtures";
import { legacyApiRoute, yieldApiRoute } from "../../mocks/api-routes";
import { rkMockWallet } from "../../utils/mock-connector";
import type { TestWorker } from "../../utils/test-extend";

type LegacyTokenDto = ReturnType<typeof legacyYieldFixture>["token"];

export const setup = (worker: TestWorker) => {
  const avalancheCToken: LegacyTokenDto = {
    name: "Avalanche C Chain",
    symbol: "AVAX",
    decimals: 18,
    network: "avalanche-c",
    coinGeckoId: "avalanche-2",
    logoURI: "https://assets.stakek.it/tokens/avax.svg",
  };
  const usdcToken: LegacyTokenDto = {
    network: "avalanche-c",
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    address: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
    coinGeckoId: "usd-coin",
    logoURI: "https://assets.stakek.it/tokens/usdc.svg",
  };

  const legacyYieldBase = legacyYieldFixture();
  const yieldApiYieldBase = yieldApiYieldFixture();
  const createLegacyYield = ({
    id,
    token,
    gasFeeToken,
  }: {
    id: string;
    token: LegacyTokenDto;
    gasFeeToken: LegacyTokenDto;
  }) =>
    legacyYieldFixture({
      id,
      token,
      tokens: [token],
      validators: [],
      metadata: {
        ...legacyYieldBase.metadata,
        type: "staking",
        gasFeeToken,
      },
    });
  const createYieldApiYield = ({
    id,
    token,
    gasFeeToken,
  }: {
    id: string;
    token: LegacyTokenDto;
    gasFeeToken: LegacyTokenDto;
  }) =>
    yieldApiYieldFixture({
      id,
      network: token.network,
      token,
      tokens: [token],
      inputTokens: [token],
      outputToken: token,
      mechanics: {
        ...yieldApiYieldBase.mechanics,
        type: "staking",
        gasFeeToken,
      },
    });
  const createYieldApiAction = (yieldId: string) =>
    yieldApiActionFixture({
      yieldId,
      transactions: [
        yieldApiTransactionFixture({
          id: `${yieldId}-transaction-0`,
          network: "avalanche-c",
          type: "STAKE",
          status: "CREATED",
        }),
        yieldApiTransactionFixture({
          id: `${yieldId}-transaction-1`,
          network: "avalanche-c",
          type: "STAKE",
          status: "CREATED",
        }),
      ],
    });

  const yieldWithSameGasAndStakeToken = {
    yieldDto: createLegacyYield({
      id: "avalanche-avax-native-staking",
      token: avalancheCToken,
      gasFeeToken: avalancheCToken,
    }),
    yieldApiDto: createYieldApiYield({
      id: "avalanche-avax-native-staking",
      token: avalancheCToken,
      gasFeeToken: avalancheCToken,
    }),
    actionDto: createYieldApiAction("avalanche-avax-native-staking"),
  };

  const yieldWithDifferentGasAndStakeToken = {
    yieldDto: createLegacyYield({
      id: "avalanche-c-usdc-aave-v3-lending",
      token: usdcToken,
      gasFeeToken: avalancheCToken,
    }),
    yieldApiDto: createYieldApiYield({
      id: "avalanche-c-usdc-aave-v3-lending",
      token: usdcToken,
      gasFeeToken: avalancheCToken,
    }),
    actionDto: createYieldApiAction("avalanche-c-usdc-aave-v3-lending"),
  };

  let avalancheCTokenAmount = "0";
  let usdcTokenAmount = "0";

  const setAvalanceCTokenAmount = (amount: number) => {
    avalancheCTokenAmount = amount.toString();
  };

  const setUsdcTokenAmount = (amount: number) => {
    usdcTokenAmount = amount.toString();
  };

  const yieldsTxGasAmountMap = new Map<
    ReturnType<typeof legacyYieldFixture>["id"],
    string
  >([]);

  const setTxGas = ({
    yieldId,
    amount,
  }: {
    yieldId: ReturnType<typeof legacyYieldFixture>["id"];
    amount: string;
  }) => yieldsTxGasAmountMap.set(yieldId, amount);

  worker.use(
    http.get(legacyApiRoute("/v1/yields/enabled/networks"), async () => {
      await delay();
      return HttpResponse.json([avalancheCToken.network]);
    }),

    http.get(legacyApiRoute("/v1/tokens"), async () => {
      await delay();

      return HttpResponse.json([
        {
          token: avalancheCToken,
          availableYields: [yieldWithSameGasAndStakeToken.yieldDto.id],
        },
        {
          token: usdcToken,
          availableYields: [yieldWithDifferentGasAndStakeToken.yieldDto.id],
        },
      ]);
    }),

    http.post(legacyApiRoute("/v1/tokens/balances/scan"), async () => {
      await delay();
      return HttpResponse.json([
        {
          token: avalancheCToken,
          amount: avalancheCTokenAmount,
          availableYields: [yieldWithSameGasAndStakeToken.yieldDto.id],
        },
        {
          token: usdcToken,
          amount: usdcTokenAmount,
          availableYields: [yieldWithDifferentGasAndStakeToken.yieldDto.id],
        },
      ]);
    }),

    http.post(legacyApiRoute("/v1/tokens/balances"), async () => {
      await delay();
      return HttpResponse.json([
        {
          token: avalancheCToken,
          amount: avalancheCTokenAmount,
          availableYields: [yieldWithSameGasAndStakeToken.yieldDto.id],
        },
        {
          token: usdcToken,
          amount: usdcTokenAmount,
          availableYields: [yieldWithDifferentGasAndStakeToken.yieldDto.id],
        },
      ]);
    }),

    http.get(
      legacyApiRoute(`/v1/yields/${yieldWithSameGasAndStakeToken.yieldDto.id}`),
      async () => {
        await delay();

        return HttpResponse.json(yieldWithSameGasAndStakeToken.yieldDto);
      }
    ),
    http.get(yieldApiRoute("/v1/yields"), async () => {
      await delay();

      const items = [
        yieldWithSameGasAndStakeToken.yieldApiDto,
        yieldWithDifferentGasAndStakeToken.yieldApiDto,
      ];

      return HttpResponse.json({
        items,
        total: items.length,
        offset: 0,
        limit: items.length,
      });
    }),
    http.get(
      yieldApiRoute(`/v1/yields/${yieldWithSameGasAndStakeToken.yieldDto.id}`),
      async () => {
        await delay();

        return HttpResponse.json(yieldWithSameGasAndStakeToken.yieldApiDto);
      }
    ),
    http.get(
      legacyApiRoute(
        `/v1/yields/${yieldWithDifferentGasAndStakeToken.yieldDto.id}`
      ),
      async () => {
        await delay();

        return HttpResponse.json(yieldWithDifferentGasAndStakeToken.yieldDto);
      }
    ),
    http.get(
      yieldApiRoute(
        `/v1/yields/${yieldWithDifferentGasAndStakeToken.yieldDto.id}`
      ),
      async () => {
        await delay();

        return HttpResponse.json(
          yieldWithDifferentGasAndStakeToken.yieldApiDto
        );
      }
    ),
    http.get(yieldApiRoute("/v1/yields/:yieldId/validators"), async (info) => {
      await delay();

      const yieldId = info.params.yieldId as string;
      const validators =
        yieldId === yieldWithSameGasAndStakeToken.yieldDto.id
          ? yieldApiValidatorsFixture([])
          : yieldApiValidatorsFixture([]);

      return HttpResponse.json({
        items: validators,
        total: validators.length,
        offset: 0,
        limit: 20,
      });
    }),
    http.post(yieldApiRoute("/v1/actions/enter"), async (info) => {
      await delay();

      const body = (await info.request.json()) as YieldCreateActionDto;
      const selectedYield =
        body.yieldId === yieldWithSameGasAndStakeToken.yieldDto.id
          ? yieldWithSameGasAndStakeToken
          : yieldWithDifferentGasAndStakeToken;
      const gasAmount = yieldsTxGasAmountMap.get(body.yieldId) ?? "0";

      return HttpResponse.json({
        ...yieldApiActionFixture({
          id: selectedYield.actionDto.id,
          yieldId: selectedYield.actionDto.yieldId,
          type: selectedYield.actionDto.type,
          address: body.address,
          amount: body.arguments?.amount ?? null,
          amountRaw: body.arguments?.amount ?? null,
          transactions: selectedYield.actionDto.transactions.map((tx, index) =>
            yieldApiTransactionFixture({
              id: tx.id,
              network: tx.network,
              type: tx.type,
              unsignedTransaction: tx.unsignedTransaction ?? null,
              gasEstimate: JSON.stringify({
                amount: gasAmount,
                token: avalancheCToken,
              }),
              status: "CREATED",
              stepIndex: index,
            })
          ),
          rawArguments: body.arguments ?? null,
          createdAt: selectedYield.actionDto.createdAt,
          completedAt: selectedYield.actionDto.completedAt,
          status: selectedYield.actionDto.status,
        }),
      });
    })
  );

  const account = "0xB6c5273e79E2aDD234EBC07d87F3824e0f94B2F7";
  const requestFn = vitest.fn(async ({ method }: { method: string }) => {
    await waitForMs(500);

    switch (method) {
      case "eth_chainId":
        return 43114;
      case "eth_requestAccounts":
        return [account];

      default:
        throw new Error("unhandled method");
    }
  });
  const customConnectors = rkMockWallet({ accounts: [account], requestFn });

  return {
    customConnectors,
    account,
    avalancheCToken,
    usdcToken,
    yieldWithSameGasAndStakeToken,
    yieldWithDifferentGasAndStakeToken,
    setTxGas,
    setAvalanceCTokenAmount,
    setUsdcTokenAmount,
  };
};
