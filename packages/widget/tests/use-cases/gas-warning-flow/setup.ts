import { waitForMs } from "@sk-widget/utils";
import type {
  ActionDto,
  ActionRequestDto,
  TokenDto,
  TransactionDto,
  YieldDto,
} from "@stakekit/api-hooks";
import {
  getActionControllerEnterResponseMock,
  getTransactionControllerConstructResponseMock,
  getYieldV2ControllerGetYieldByIdResponseMock,
} from "@stakekit/api-hooks/msw";
import { delay, HttpResponse, http } from "msw";
import { Just } from "purify-ts";
import { vitest } from "vitest";
import { server } from "../../mocks/server";
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

  const yieldWithSameGasAndStakeToken = Just(
    getYieldV2ControllerGetYieldByIdResponseMock()
  )
    .map((val) => ({
      yieldDto: {
        ...val,
        id: "avalanche-avax-native-staking",
        token: avalancheCToken,
        tokens: [avalancheCToken],
        status: { enter: true, exit: true },
        args: { enter: { args: { nfts: undefined } } },
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
        ...getActionControllerEnterResponseMock(),
        integrationId: val.yieldDto.id,
        transactions: [
          {
            ...getTransactionControllerConstructResponseMock(),
            status: "CREATED",
            stakeId: val.yieldDto.id,
            gasEstimate: null,
          },
          {
            ...getTransactionControllerConstructResponseMock(),
            status: "CREATED",
            stakeId: val.yieldDto.id,
            gasEstimate: null,
          },
        ],
      } satisfies ActionDto,
    }))
    .unsafeCoerce();

  const yieldWithDifferentGasAndStakeToken = Just(
    getYieldV2ControllerGetYieldByIdResponseMock()
  )
    .map((val) => ({
      yieldDto: {
        ...val,
        id: "avalanche-c-usdc-aave-v3-lending",
        token: usdcToken,
        tokens: [usdcToken],
        status: { enter: true, exit: true },
        args: { enter: { args: { nfts: undefined } } },
        metadata: {
          ...val.metadata,
          type: "staking",
          gasFeeToken: avalancheCToken,
        },
      } satisfies YieldDto,
    }))
    .map((val) => ({
      ...val,
      actionDto: getActionControllerEnterResponseMock({
        integrationId: val.yieldDto.id,
        transactions: [
          {
            ...getTransactionControllerConstructResponseMock(),
            stakeId: val.yieldDto.id,
            status: "CREATED",
            gasEstimate: null,
          },
          {
            ...getTransactionControllerConstructResponseMock(),
            stakeId: val.yieldDto.id,
            status: "CREATED",
            gasEstimate: null,
          },
        ],
      }),
    }))
    .unsafeCoerce();

  let availableAmount = "5";

  const setAvailableAmount = (amount: number) => {
    availableAmount = amount.toString();
  };

  const yieldsTxGasAmountMap = new Map<
    `${YieldDto["id"]}-${TransactionDto["id"]}`,
    string
  >([]);

  const setTxGas = ({
    txId,
    yieldId,
    amount,
  }: {
    yieldId: YieldDto["id"];
    txId: TransactionDto["id"];
    amount: string;
  }) => yieldsTxGasAmountMap.set(`${yieldId}-${txId}`, amount);

  server.use(
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
          amount: availableAmount,
          availableYields: [yieldWithSameGasAndStakeToken.yieldDto.id],
        },
        {
          token: usdcToken,
          amount: availableAmount,
          availableYields: [yieldWithDifferentGasAndStakeToken.yieldDto.id],
        },
      ]);
    }),

    http.post("*/v1/tokens/balances", async () => {
      await delay();
      return HttpResponse.json([
        {
          token: avalancheCToken,
          amount: availableAmount,
        },
        {
          token: usdcToken,
          amount: availableAmount,
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
    http.post("*/v1/actions/enter", async (info) => {
      await delay();

      const body = (await info.request.json()) as ActionRequestDto;

      return HttpResponse.json({
        ...(body.integrationId === yieldWithSameGasAndStakeToken.yieldDto.id
          ? yieldWithSameGasAndStakeToken.actionDto
          : yieldWithDifferentGasAndStakeToken.actionDto),
        amount: body.args.amount,
      } as ActionDto);
    }),
    http.patch("*/v1/transactions/:transactionId", async (info) => {
      const transactionId = info.params.transactionId as string;

      const yieldWithAction = [
        yieldWithSameGasAndStakeToken,
        yieldWithDifferentGasAndStakeToken,
      ].find((val) =>
        val.actionDto.transactions.some((tx) => tx.id === transactionId)
      );

      if (!yieldWithAction) {
        return new HttpResponse(null, { status: 400 });
      }

      const tx = yieldWithAction.actionDto.transactions.find(
        (tx) => tx.id === transactionId
      );

      if (!tx) {
        return new HttpResponse(null, { status: 400 });
      }

      await delay();

      return HttpResponse.json({
        ...tx,
        gasEstimate: {
          token: yieldWithAction.yieldDto.token,
          amount:
            yieldsTxGasAmountMap.get(
              `${yieldWithAction.yieldDto.id}-${tx.id}`
            ) ?? "0",
        },
      } satisfies TransactionDto);
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
    setAvailableAmount,
  };
};
