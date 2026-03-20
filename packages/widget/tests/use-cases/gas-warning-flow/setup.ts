import type {
  ActionDto,
  TokenDto,
  TransactionDto,
  YieldDto,
} from "@stakekit/api-hooks";
import { delay, HttpResponse, http } from "msw";
import { Just } from "purify-ts";
import { vitest } from "vitest";
import type { YieldCreateActionDto } from "../../../src/providers/yield-api-client-provider/types";
import { waitForMs } from "../../../src/utils";
import {
  enterResponseFixture,
  transactionConstructFixture,
  yieldApiActionFixture,
  yieldApiTransactionFixture,
  yieldFixture,
  yieldValidatorsFixture,
} from "../../fixtures";
import { worker } from "../../mocks/worker";
import { rkMockWallet } from "../../utils/mock-connector";

export const setup = () => {
  const avalancheCToken: TokenDto = {
    name: "Avalanche C Chain",
    symbol: "AVAX",
    decimals: 18,
    network: "avalanche-c",
    coinGeckoId: "avalanche-2",
    logoURI: "https://assets.stakek.it/tokens/avax.svg",
  };
  const usdcToken: TokenDto = {
    network: "avalanche-c",
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    address: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
    coinGeckoId: "usd-coin",
    logoURI: "https://assets.stakek.it/tokens/usdc.svg",
  };

  const yieldWithSameGasAndStakeToken = Just(yieldFixture())
    .map((val) => ({
      yieldDto: {
        ...val,
        id: "avalanche-avax-native-staking",
        token: avalancheCToken,
        tokens: [avalancheCToken],
        validators: [],
        metadata: {
          ...val.metadata,
          type: "staking",
          gasFeeToken: avalancheCToken,
        },
      } satisfies YieldDto,
    }))
    .map((val) => ({
      ...val,
      actionDto: {
        ...enterResponseFixture(),
        integrationId: val.yieldDto.id,
        transactions: [
          {
            ...transactionConstructFixture(),
            status: "CREATED",
            stakeId: val.yieldDto.id,
            gasEstimate: null,
          },
          {
            ...transactionConstructFixture(),
            status: "CREATED",
            stakeId: val.yieldDto.id,
            gasEstimate: null,
          },
        ],
      } satisfies ActionDto,
    }))
    .unsafeCoerce();

  const yieldWithDifferentGasAndStakeToken = Just(yieldFixture())
    .map((val) => ({
      yieldDto: {
        ...val,
        id: "avalanche-c-usdc-aave-v3-lending",
        token: usdcToken,
        tokens: [usdcToken],
        validators: [],
        metadata: {
          ...val.metadata,
          type: "staking",
          gasFeeToken: avalancheCToken,
        },
      } satisfies YieldDto,
    }))
    .map((val) => ({
      ...val,
      actionDto: enterResponseFixture({
        integrationId: val.yieldDto.id,
        transactions: [
          {
            ...transactionConstructFixture(),
            stakeId: val.yieldDto.id,
            status: "CREATED",
            gasEstimate: null,
          },
          {
            ...transactionConstructFixture(),
            stakeId: val.yieldDto.id,
            status: "CREATED",
            gasEstimate: null,
          },
        ],
      }),
    }))
    .unsafeCoerce();

  let avalancheCTokenAmount = "0";
  let usdcTokenAmount = "0";

  const setAvalanceCTokenAmount = (amount: number) => {
    avalancheCTokenAmount = amount.toString();
  };

  const setUsdcTokenAmount = (amount: number) => {
    usdcTokenAmount = amount.toString();
  };

  const yieldsTxGasAmountMap = new Map<YieldDto["id"], string>([]);

  const setTxGas = ({
    yieldId,
    amount,
  }: {
    yieldId: YieldDto["id"];
    amount: string;
  }) => yieldsTxGasAmountMap.set(yieldId, amount);

  worker.use(
    http.get("*/v1/yields/enabled/networks", async () => {
      await delay();
      return HttpResponse.json([avalancheCToken.network]);
    }),

    http.get("*/v1/tokens", async () => {
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

    http.post("*/v1/tokens/balances/scan", async () => {
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

    http.post("*/v1/tokens/balances", async () => {
      await delay();
      return HttpResponse.json([
        {
          token: avalancheCToken,
          amount: avalancheCTokenAmount,
        },
        {
          token: usdcToken,
          amount: usdcTokenAmount,
        },
      ]);
    }),

    http.get(
      `*/v1/yields/${yieldWithSameGasAndStakeToken.yieldDto.id}`,
      async () => {
        await delay();

        return HttpResponse.json(yieldWithSameGasAndStakeToken.yieldDto);
      }
    ),
    http.get(
      `*/v1/yields/${yieldWithDifferentGasAndStakeToken.yieldDto.id}`,
      async () => {
        await delay();

        return HttpResponse.json(yieldWithDifferentGasAndStakeToken.yieldDto);
      }
    ),
    http.get("*/v1/yields/:yieldId/validators", async (info) => {
      await delay();

      const yieldId = info.params.yieldId as string;
      const validators =
        yieldId === yieldWithSameGasAndStakeToken.yieldDto.id
          ? yieldValidatorsFixture(
              yieldWithSameGasAndStakeToken.yieldDto.validators
            )
          : yieldValidatorsFixture(
              yieldWithDifferentGasAndStakeToken.yieldDto.validators
            );

      return HttpResponse.json({
        items: validators,
        total: validators.length,
      });
    }),
    http.post("*/v1/actions/enter", async (info) => {
      await delay();

      const body = (await info.request.json()) as YieldCreateActionDto;
      const selectedYield =
        body.yieldId === yieldWithSameGasAndStakeToken.yieldDto.id
          ? yieldWithSameGasAndStakeToken
          : yieldWithDifferentGasAndStakeToken;
      const gasAmount = yieldsTxGasAmountMap.get(body.yieldId) ?? "0";

      return HttpResponse.json({
        ...yieldApiActionFixture({
          action: selectedYield.actionDto as ActionDto,
          address: body.address,
          rawArguments: body.arguments ?? null,
          transactions: selectedYield.actionDto.transactions.map((tx, index) =>
            yieldApiTransactionFixture(tx as TransactionDto, {
              gasEstimate: gasAmount,
              status: "CREATED",
              stepIndex: index,
            })
          ),
          overrides: {
            amount: body.arguments?.amount ?? null,
            amountRaw: body.arguments?.amount ?? null,
          },
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
