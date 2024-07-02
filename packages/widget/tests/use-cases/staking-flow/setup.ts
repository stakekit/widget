import type {
  ActionDto,
  ActionRequestDto,
  TokenDto,
  TransactionDto,
  YieldDto,
} from "@stakekit/api-hooks";
import { http, HttpResponse, delay } from "msw";
import { vitest } from "vitest";
import { waitForMs } from "../../../src/utils";
import { server } from "../../mocks/server";
import { rkMockWallet } from "../../utils/mock-connector";

export const setup = async () => {
  const token: TokenDto = {
    name: "Avalanche C Chain",
    symbol: "AVAX",
    decimals: 18,
    network: "avalanche-c",
    coinGeckoId: "avalanche-2",
    logoURI: "https://assets.stakek.it/tokens/avax.svg",
  };

  const amount = "6.367499123588739454";

  const yieldOp: YieldDto = {
    apy: 0.05863407069791653,
    rewardRate: 0.05863407069791653,
    rewardType: "apy",
    args: {
      enter: {
        addresses: {
          address: {
            required: true,
            network: "avalanche-c",
          },
        },
        args: {
          amount: {
            required: true,
            minimum: 0,
          },
        },
      },
      exit: {
        addresses: {
          address: {
            required: true,
            network: "avalanche-c",
          },
        },
        args: {
          amount: {
            required: true,
            minimum: 0,
          },
        },
      },
    },
    id: "avalanche-avax-liquid-staking",
    token,
    tokens: [token],
    metadata: {
      cooldownPeriod: {
        days: 15,
      },
      description: "Stake your AVAX with Benqi",
      fee: {
        enabled: false,
        depositFee: false,
        managementFee: false,
        performanceFee: false,
      },
      gasFeeToken: token,
      logoURI: "https://assets.stakek.it/tokens/savax.svg",
      name: "Benqi Staked AVAX",
      provider: {
        id: "benqi",
        name: "Benqi",
        description: "",
        externalLink: "https://benqi.fi/",
        logoURI: "https://assets.stakek.it/providers/benqi.svg",
      },
      revshare: {
        enabled: true,
      },
      rewardClaiming: "auto",
      rewardSchedule: "day",
      rewardTokens: [
        {
          name: "Staked AVAX",
          symbol: "sAVAX",
          decimals: 18,
          network: "avalanche-c",
          logoURI: "https://assets.stakek.it/tokens/savax.svg",
          address: "0x2b2c81e08f1af8835a78bb2a90ae924ace0ea4be",
        },
      ],
      supportsMultipleValidators: false,
      token,
      type: "liquid-staking",
      warmupPeriod: {
        days: 0,
      },
      withdrawPeriod: {
        days: 2,
      },
      documentation:
        "https://docs.stakek.it/docs/avalanche-avax-liquid-staking",
      supportsLedgerWalletApi: true,
    },
    status: {
      enter: true,
      exit: true,
    },
    validators: [],
    isAvailable: true,
  };

  const enterAction: ActionDto = {
    id: "18bdda99-346a-4694-af71-58dfea68d542",
    integrationId: "avalanche-avax-liquid-staking",
    status: "CREATED",
    type: "STAKE",
    currentStepIndex: 0,
    amount: null,
    tokenId: null,
    validatorAddress: null,
    validatorAddresses: null,
    transactions: [
      {
        id: "9aa80e02-3d81-4b0f-aa0b-155138b77293",
        network: "avalanche-c",
        status: "CREATED",
        type: "STAKE",
        hash: null,
        signedTransaction: null,
        unsignedTransaction: null,
        stepIndex: 0,
        error: null,
        gasEstimate: null,
        explorerUrl: null,
        stakeId: "",
        ledgerHwAppId: null,
        isMessage: false,
      },
    ],
    createdAt: "2023-12-28T14:36:21.700Z",
  };

  const transactionConstruct: TransactionDto = {
    id: "",
    network: token.network,
    status: "WAITING_FOR_SIGNATURE",
    type: "STAKE",
    hash: null,
    signedTransaction: null,
    unsignedTransaction:
      '{"from":"0xB6c5273e79E2aDD234EBC07d87F3824e0f94B2F7","gasLimit":"56572","value":"10000000000000000","to":"0x2b2c81e08f1af8835a78bb2a90ae924ace0ea4be","data":"0x5bcb2fc6","nonce":122,"type":2,"maxFeePerGas":"50000000000","maxPriorityFeePerGas":"0","chainId":43114}',
    stepIndex: 0,
    error: null,
    gasEstimate: {
      amount: "0.002828600000000000",
      gasLimit: "56572",
      token: {
        name: "Avalanche C Chain",
        symbol: "AVAX",
        decimals: 18,
        network: "avalanche-c",
        coinGeckoId: "avalanche-2",
        logoURI: "https://assets.stakek.it/tokens/avax.svg",
      },
    },
    stakeId: "b920e4ea-4f85-434a-a2ee-b70176e15b67",
    explorerUrl: null,
    ledgerHwAppId: null,
    isMessage: false,
  };

  server.use(
    http.get("*/v1/yields/enabled/networks", async () => {
      await delay();
      return HttpResponse.json(["avalanche-c"]);
    }),

    http.get("*/v1/tokens", async () => {
      await delay();

      return HttpResponse.json([
        {
          token: {
            name: "Avalanche C Chain",
            symbol: "AVAX",
            decimals: 18,
            network: "avalanche-c",
            coinGeckoId: "avalanche-2",
            logoURI: "https://assets.stakek.it/tokens/avax.svg",
          },
          availableYields: ["avalanche-avax-liquid-staking"],
        },
      ]);
    }),

    http.post("*/v1/tokens/balances/scan", async () => {
      await delay();
      return HttpResponse.json([
        {
          token,
          amount,
          availableYields: ["avalanche-avax-liquid-staking"],
        },
      ]);
    }),

    http.post("*/v1/tokens/balances", async () => {
      await delay();
      return HttpResponse.json([{ token, amount }]);
    }),

    http.post("*/v1/tokens/prices", async () => {
      await delay();
      return HttpResponse.json({
        "avalanche-c-undefined": {
          price: 43.92,
          price_24_h: -5.378057848410026,
        },
      });
    }),
    http.get("*/v1/yields/avalanche-avax-liquid-staking", async () => {
      await delay();
      return HttpResponse.json(yieldOp);
    }),
    http.get("*/v1/transactions/gas/avalanche-c", async () => {
      await delay();
      return HttpResponse.json({
        customisable: true,
        modes: {
          denom: "gwei",
          values: [
            {
              name: "slow",
              value: "40",
              gasArgs: {
                denom: "wei",
                type: 2,
                maxFeePerGas: "40000000000",
                maxPriorityFeePerGas: "0",
              },
            },
            {
              name: "average",
              value: "50",
              gasArgs: {
                denom: "wei",
                type: 2,
                maxFeePerGas: "50000000000",
                maxPriorityFeePerGas: "0",
              },
            },
            {
              name: "fast",
              value: "75",
              gasArgs: {
                denom: "wei",
                type: 2,
                maxFeePerGas: "75000000000",
                maxPriorityFeePerGas: "0",
              },
            },
          ],
        },
      });
    }),
    http.post("*/v1/actions/enter/estimate-gas", async () => {
      await delay();
      return HttpResponse.json({
        amount: "0.002828600000000000",
        token: {
          network: "polygon",
          coinGeckoId: "matic-network",
          name: "Polygon",
          decimals: 18,
          symbol: "MATIC",
          logoURI: "https://assets.stakek.it/tokens/matic.svg",
        },
        gasLimit: "",
      });
    }),
    http.post("*/v1/actions/enter", async (info) => {
      await delay();

      const body = (await info.request.json()) as ActionRequestDto;

      return HttpResponse.json({ ...enterAction, amount: body.args.amount });
    }),
    http.patch("*/v1/transactions/:transactionId", async (info) => {
      const transactionId = info.params.transactionId as string;

      await delay();

      return HttpResponse.json({ ...transactionConstruct, id: transactionId });
    }),
    http.post("*/v1/transactions/:transactionId/submit_hash", async () => {
      await delay(1000);
      return new HttpResponse(null, { status: 201 });
    }),
    http.get("*/v1/transactions/:transactionId/status", async () => {
      return HttpResponse.json({
        url: "https://snowtrace.dev/tx/0x5c2e4ac81fa12b8e935e1cf5e39eda4594d75e82da0c9b44c6d85f20214452fb",
        network: "avalanche-c",
        hash: "0x5c2e4ac81fa12b8e935e1cf5e39eda4594d75e82da0c9b44c6d85f20214452fb",
        status: "CONFIRMED",
      });
    })
  );

  const account = "0xB6c5273e79E2aDD234EBC07d87F3824e0f94B2F7";

  const requestFn = vitest.fn(async ({ method }: { method: string }) => {
    await waitForMs(500);

    switch (method) {
      case "eth_sendTransaction":
        return "transaction_hash";
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
    yieldOp,
    enterAction,
    transactionConstruct,
    account,
    requestFn,
  };
};
