import { HttpResponse, http } from "msw";
import { vitest } from "vitest";

import type { ActionCommand } from "../../../../src/domain/earn/action-models";
import { exactDecimal } from "../../../../src/domain/finance/exact";
import {
  yieldApiActionFixture,
  yieldApiTransactionFixture,
  yieldApiValidatorsFixture,
  yieldApiYieldDtoFixture,
} from "../../../fixtures";
import type { TokenDto as LegacyTokenDto } from "../../../generated/legacy-api-types";
import { legacyApiRoute, yieldApiRoute } from "../../../mocks/api-routes";
import { mockDelay } from "../../../mocks/delay";
import { mockWalletListFactory } from "../../../utils/mock-connector";
import type { TestWorker } from "../../../utils/test-extend";
import { waitForMs } from "../../../utils/wait";

/** One AVAX staking yield whose gas is paid in the staked token. */
export const setup = (worker: TestWorker) => {
  const avalancheCToken: LegacyTokenDto = {
    name: "Avalanche C Chain",
    symbol: "AVAX",
    decimals: 18,
    network: "avalanche-c",
    coinGeckoId: "avalanche-2",
    logoURI: "https://assets.stakek.it/tokens/avax.svg",
  };

  const yieldId = "avalanche-avax-native-staking";
  const yieldDto = yieldApiYieldDtoFixture({
    id: yieldId,
    network: avalancheCToken.network,
    token: avalancheCToken,
    tokens: [avalancheCToken],
    inputTokens: [avalancheCToken],
    outputToken: avalancheCToken,
    mechanics: {
      ...yieldApiYieldDtoFixture().mechanics,
      type: "staking",
      gasFeeToken: avalancheCToken,
    },
  });
  const actionDto = yieldApiActionFixture({
    yieldId,
    transactions: [0, 1].map((index) =>
      yieldApiTransactionFixture({
        id: `${yieldId}-transaction-${index}`,
        network: "avalanche-c",
        type: "STAKE",
        status: "CREATED",
      })
    ),
  });

  let avalancheCTokenAmount = "0";
  let txGasAmount = "0";

  const setAvalanceCTokenAmount = (amount: number) => {
    avalancheCTokenAmount = amount.toString();
  };

  const setTxGas = (amount: string) => {
    txGasAmount = amount;
  };

  const tokenBalances = () => [
    {
      token: avalancheCToken,
      amount: avalancheCTokenAmount,
      availableYields: [yieldId],
    },
  ];

  worker.use(
    http.get(yieldApiRoute("/v1/networks"), async () => {
      await mockDelay();
      return HttpResponse.json([{ id: avalancheCToken.network }]);
    }),

    http.get(legacyApiRoute("/v1/tokens"), async () => {
      await mockDelay();

      return HttpResponse.json([
        { token: avalancheCToken, availableYields: [yieldId] },
      ]);
    }),

    http.get(
      legacyApiRoute("/v2/networks/:network/addresses/:address/tokens"),
      async () => {
        await mockDelay();
        return HttpResponse.json(tokenBalances());
      }
    ),

    http.post(legacyApiRoute("/v1/tokens/balances"), async () => {
      await mockDelay();
      return HttpResponse.json(tokenBalances());
    }),

    http.get(yieldApiRoute("/v1/yields"), async () => {
      await mockDelay();

      return HttpResponse.json({
        items: [yieldDto],
        total: 1,
        offset: 0,
        limit: 1,
      });
    }),
    http.get(yieldApiRoute(`/v1/yields/${yieldId}`), async () => {
      await mockDelay();

      return HttpResponse.json(yieldDto);
    }),
    http.get(yieldApiRoute("/v1/yields/:yieldId/validators"), async () => {
      await mockDelay();

      const validators = yieldApiValidatorsFixture([]);

      return HttpResponse.json({
        items: validators,
        total: validators.length,
        offset: 0,
        limit: 20,
      });
    }),
    http.post(yieldApiRoute("/v1/actions/enter"), async (info) => {
      await mockDelay();

      const body = (await info.request.json()) as ActionCommand;

      return HttpResponse.json({
        ...yieldApiActionFixture({
          id: actionDto.id,
          yieldId: actionDto.yieldId,
          type: actionDto.type,
          address: body.address,
          amount:
            body.arguments?.amount === undefined
              ? null
              : exactDecimal(body.arguments.amount).toFixed(),
          amountRaw: null,
          transactions: actionDto.transactions.map((tx, index) =>
            yieldApiTransactionFixture({
              id: tx.id,
              network: tx.network,
              type: tx.type,
              unsignedTransaction: tx.unsignedTransaction ?? null,
              gasEstimate: JSON.stringify({
                amount: txGasAmount,
                token: avalancheCToken,
              }),
              status: "CREATED",
              stepIndex: index,
            })
          ),
          rawArguments: body.arguments ?? null,
          createdAt: actionDto.createdAt,
          completedAt: actionDto.completedAt,
          status: actionDto.status,
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
  const customConnectors = mockWalletListFactory({
    accounts: [account],
    requestFn,
  });

  return {
    account,
    actionDto,
    customConnectors,
    setAvalanceCTokenAmount,
    setTxGas,
    yieldDto,
  };
};
