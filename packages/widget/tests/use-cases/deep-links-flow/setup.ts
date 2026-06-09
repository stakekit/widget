import { delay, HttpResponse, http } from "msw";
import { Just } from "purify-ts";
import { vitest } from "vitest";
import type { YieldCreateManageActionDto } from "../../../src/domain/types/action";
import { waitForMs } from "../../../src/utils";
import {
  legacyYieldFixture,
  yieldApiActionFixture,
  yieldApiTransactionFixture,
  yieldApiValidatorFixture,
  yieldApiValidatorsFixture,
  yieldApiYieldFixture,
} from "../../fixtures";
import { legacyApiRoute, yieldApiRoute } from "../../mocks/api-routes";
import { rkMockWallet } from "../../utils/mock-connector";
import type { TestWorker } from "../../utils/test-extend";
import { setUrl as _setUrl } from "./utils";

type LegacyTokenDto = ReturnType<typeof legacyYieldFixture>["token"];

export const setup = async (
  worker: TestWorker,
  opts?: {
    withValidatorAddressesRequired?: boolean;
  }
) => {
  const account = "0xB6c5273e79E2aDD234EBC07d87F3824e0f94B2F7";

  const ether: LegacyTokenDto = {
    network: "ethereum",
    name: "Ethereum",
    symbol: "ETH",
    decimals: 18,
    coinGeckoId: "ethereum",
    logoURI: "https://assets.stakek.it/tokens/eth.svg",
  };

  const token: LegacyTokenDto = {
    name: "Avalanche C Chain",
    symbol: "AVAX",
    decimals: 18,
    network: "avalanche-c",
    coinGeckoId: "avalanche-2",
    logoURI: "https://assets.stakek.it/tokens/avax.svg",
  };

  const amount = "6.367499123588739454";
  const avaxNativeStakingRewardRate = 0.0508;
  const avaxLiquidStakingRewardRate = 0.0475;

  const legacyYieldBase = legacyYieldFixture();
  const yieldApiYieldBase = yieldApiYieldFixture();
  const avaxNativeStaking = legacyYieldFixture({
    id: "avalanche-avax-native-staking",
    token,
    tokens: [token],
    rewardRate: avaxNativeStakingRewardRate,
    rewardType: "apy",
    apy: avaxNativeStakingRewardRate,
    metadata: { ...legacyYieldBase.metadata, type: "staking" },
    validators: [],
  });

  const avaxLiquidStakingLegacyValidators = opts?.withValidatorAddressesRequired
    ? [
        {
          address: "0xe92b7ba8497486e94bb59c51f595b590c4a5f894",
          status: "active" as const,
          name: "Stakely",
          image: "https://assets.stakek.it/validators/stakely.png",
          website: "https://stakely.io/",
          apr: 0.0393,
          commission: 0.1,
          stakedBalance: "2263157",
          votingPower: 0.0090962642447408,
          preferred: true,
        },
      ]
    : [];
  const avaxLiquidStakingValidators = avaxLiquidStakingLegacyValidators.map(
    (validator) =>
      yieldApiValidatorFixture({
        address: validator.address,
        status: validator.status,
        name: validator.name,
        logoURI: validator.image,
        website: validator.website,
        rewardRate: {
          total: validator.apr,
          rateType: "APR",
          components: [],
        },
        commission: validator.commission,
        tvl: validator.stakedBalance,
        votingPower: validator.votingPower,
        preferred: validator.preferred,
      })
  );

  const rewardToken = {
    name: "Staked AVAX",
    symbol: "sAVAX",
    decimals: 18,
    network: token.network,
    logoURI: "https://assets.stakek.it/tokens/savax.svg",
    address: "0x2b2c81e08f1af8835a78bb2a90ae924ace0ea4be",
  };
  const avaxLiquidStaking = legacyYieldFixture({
    id: "avalanche-avax-liquid-staking",
    token,
    tokens: [token],
    rewardRate: avaxLiquidStakingRewardRate,
    rewardType: "apy",
    apy: avaxLiquidStakingRewardRate,
    metadata: {
      ...legacyYieldBase.metadata,
      name: "AVAX Liquid Staking",
      type: "liquid-staking",
      provider: {
        id: "benqi",
        name: "Benqi",
        description: "",
        externalLink: "https://benqi.fi/",
        logoURI: "https://assets.stakek.it/providers/benqi.svg",
      },
      rewardTokens: [rewardToken],
    },
    validators: avaxLiquidStakingLegacyValidators,
  });
  const avaxNativeStakingYieldApi = yieldApiYieldFixture({
    id: avaxNativeStaking.id,
    network: token.network,
    token,
    tokens: [token],
    inputTokens: [token],
    outputToken: token,
    rewardRate: {
      ...yieldApiYieldBase.rewardRate,
      total: avaxNativeStaking.rewardRate,
    },
    mechanics: {
      ...yieldApiYieldBase.mechanics,
      type: "staking",
      gasFeeToken: token,
    },
  });
  const avaxLiquidStakingYieldApi = yieldApiYieldFixture({
    id: avaxLiquidStaking.id,
    network: token.network,
    providerId: avaxLiquidStaking.metadata.provider?.id ?? "benqi",
    token,
    tokens: [token],
    inputTokens: [token],
    outputToken: rewardToken,
    rewardRate: {
      ...yieldApiYieldBase.rewardRate,
      total: avaxLiquidStaking.rewardRate,
    },
    metadata: {
      ...yieldApiYieldBase.metadata,
      name: "AVAX Liquid Staking",
    },
    mechanics: {
      ...yieldApiYieldBase.mechanics,
      type: "staking",
      requiresValidatorSelection: avaxLiquidStakingValidators.length > 0,
      gasFeeToken: token,
    },
  });

  const pendingActionAmount = "0.019258000000000000";
  const legacyPendingActions = [
    {
      args: {
        args: {
          validatorAddresses: {
            required: !!opts?.withValidatorAddressesRequired,
          },
        },
      },
      amount: pendingActionAmount,
      type: "CLAIM_REWARDS" as const,
      passthrough:
        "eyJhZGRyZXNzZXMiOnsiYWRkcmVzcyI6IlRTWjFBazlaVjNOam1Wd3NUejNxMnNuYzdYR1FFSlZTRUQifX0=",
    },
  ];
  const yieldApiPendingActions = [
    {
      intent: "manage" as const,
      type: "CLAIM_REWARDS" as const,
      passthrough:
        "eyJhZGRyZXNzZXMiOnsiYWRkcmVzcyI6IlRTWjFBazlaVjNOam1Wd3NUejNxMnNuYzdYR1FFSlZTRUQifX0=",
      amount: pendingActionAmount,
      arguments: {
        fields: opts?.withValidatorAddressesRequired
          ? [
              {
                name: "validatorAddresses" as const,
                type: "address" as const,
                label: "Validators",
                required: true,
                isArray: true,
              },
            ]
          : [],
      },
    },
  ];
  const avaxLiquidStakingBalances = [
    {
      groupId: "b4684f63-fe54-540d-b0ae-06a2c2ecdb9e",
      type: "rewards",
      amount: pendingActionAmount,
      pendingActions: legacyPendingActions,
      pricePerShare: "1",
      token: avaxLiquidStaking.token,
    },
  ];

  const avaxLiquidStakingBalancesV2 = [
    {
      address: account,
      type: "claimable",
      amount: pendingActionAmount,
      amountRaw: "19258000000000000",
      pendingActions: yieldApiPendingActions,
      token: avaxLiquidStaking.token,
      amountUsd: "0.84",
      isEarning: false,
    },
  ];

  const pendingTransaction = yieldApiTransactionFixture({
    id: "be6f79f6-938e-48e5-bc38-8f7485d6ea67",
    network: token.network,
    type: "CLAIM_REWARDS",
    status: "CREATED",
    isMessage: false,
  });
  const pendingAction = yieldApiActionFixture({
    id: "pending-claim-rewards-action",
    intent: "manage",
    type: "CLAIM_REWARDS",
    yieldId: avaxLiquidStaking.id,
    address: account,
    transactions: [pendingTransaction],
  });

  worker.use(
    http.get(legacyApiRoute("/v1/tokens"), async () => {
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
        { token: ether, availableYields: ["ethereum-eth-etherfi-staking"] },
      ]);
    }),
    http.get(legacyApiRoute("/v1/yields/enabled/networks"), async () => {
      await delay();
      return HttpResponse.json([token.network, ether.network]);
    }),

    http.post(legacyApiRoute("/v1/tokens/balances/scan"), async () => {
      await delay();
      return HttpResponse.json([
        {
          token,
          amount,
          availableYields: [avaxNativeStaking.id, avaxLiquidStaking.id],
        },
      ]);
    }),

    http.post(legacyApiRoute("/v1/tokens/balances"), async () => {
      await delay();
      return HttpResponse.json([
        {
          token,
          amount,
          availableYields: [avaxNativeStaking.id, avaxLiquidStaking.id],
        },
      ]);
    }),

    http.post(legacyApiRoute("/v1/tokens/prices"), async () => {
      await delay();
      return HttpResponse.json({
        "avalanche-c-undefined": {
          price: 43.92,
          price_24_h: -5.378057848410026,
        },
      });
    }),
    http.get(legacyApiRoute(`/v1/yields/${avaxNativeStaking.id}`), async () => {
      await delay();
      return HttpResponse.json(avaxNativeStaking);
    }),
    http.get(yieldApiRoute("/v1/yields"), async () => {
      await delay();

      const items = [avaxNativeStakingYieldApi, avaxLiquidStakingYieldApi];

      return HttpResponse.json({
        items,
        total: items.length,
        offset: 0,
        limit: items.length,
      });
    }),
    http.get(yieldApiRoute(`/v1/yields/${avaxNativeStaking.id}`), async () => {
      await delay();
      return HttpResponse.json(avaxNativeStakingYieldApi);
    }),
    http.get(legacyApiRoute(`/v1/yields/${avaxLiquidStaking.id}`), async () => {
      await delay();
      return HttpResponse.json(avaxLiquidStaking);
    }),
    http.get(yieldApiRoute(`/v1/yields/${avaxLiquidStaking.id}`), async () => {
      await delay();
      return HttpResponse.json(avaxLiquidStakingYieldApi);
    }),
    http.get(yieldApiRoute("/v1/yields/:yieldId/validators"), async (info) => {
      await delay();

      const yieldId = info.params.yieldId as string;
      const validators =
        yieldId === avaxLiquidStaking.id
          ? avaxLiquidStakingValidators.length
            ? yieldApiValidatorsFixture(avaxLiquidStakingValidators)
            : []
          : yieldId === avaxNativeStaking.id
            ? []
            : [];

      return HttpResponse.json({
        items: validators,
        total: validators.length,
        offset: 0,
        limit: 20,
      });
    }),
    http.post(legacyApiRoute("/v1/yields/balances/scan"), async () => {
      await delay();
      return HttpResponse.json([
        {
          balances: avaxLiquidStakingBalances,
          integrationId: avaxLiquidStaking.id,
        },
      ]);
    }),
    http.post(yieldApiRoute("/v1/yields/balances"), async () => {
      await delay();
      return HttpResponse.json({
        items: [
          {
            yieldId: avaxLiquidStaking.id,
            balances: avaxLiquidStakingBalancesV2,
          },
        ],
        errors: [],
      });
    }),
    http.post(
      legacyApiRoute(`/v1/yields/${avaxNativeStaking.id}/balances/scan`),
      async () => {
        await delay();
        return HttpResponse.json({
          integrationId: avaxLiquidStaking.id,
          balances: avaxLiquidStakingBalances,
        });
      }
    ),
    http.post(
      yieldApiRoute(`/v1/yields/${avaxLiquidStaking.id}/balances`),
      async () => {
        await delay();
        return HttpResponse.json({
          yieldId: avaxLiquidStaking.id,
          balances: avaxLiquidStakingBalancesV2,
        });
      }
    ),
    http.post(yieldApiRoute("/v1/actions/manage"), async (info) => {
      const data = (await info.request.json()) as YieldCreateManageActionDto;
      await delay();

      return HttpResponse.json({
        ...yieldApiActionFixture({
          id: pendingAction.id,
          yieldId: data.yieldId,
          type: pendingAction.type,
          address: data.address,
          amount: pendingAction.amount,
          amountRaw: pendingAction.amount,
          amountUsd: pendingAction.amountUsd,
          transactions: [
            yieldApiTransactionFixture({
              id: pendingAction.transactions[0].id,
              network: pendingAction.transactions[0].network,
              type: "CLAIM_REWARDS",
              status: "CREATED",
              unsignedTransaction:
                '{"from":"0xcaA141ece9fEE66D15f0257F5c6C48E26784345C","gasLimit":"0x0193e0","to":"0x7D2382b1f8Af621229d33464340541Db362B4907","data":"0x00f714ce00000000000000000000000000000000000000000000000000037cb07e6e4276000000000000000000000000caa141ece9fee66d15f0257f5c6c48e26784345c","nonce":89,"type":2,"maxFeePerGas":"0xbfa6de","maxPriorityFeePerGas":"0x0f4240","chainId":43114}',
            }),
          ],
          rawArguments: data.arguments ?? null,
          createdAt: pendingAction.createdAt,
          completedAt: pendingAction.completedAt,
          status: pendingAction.status,
        }),
      });
    }),
    http.put(
      yieldApiRoute("/v1/transactions/:transactionId/submit-hash"),
      async (info) => {
        await delay();

        const transactionId = info.params.transactionId as string;

        return HttpResponse.json({
          ...yieldApiTransactionFixture({
            type: "CLAIM_REWARDS",
            network: pendingAction.transactions[0].network,
            status: "BROADCASTED",
            id: transactionId,
            hash: "transaction_hash",
          }),
        });
      }
    ),
    http.get(yieldApiRoute("/v1/transactions/:transactionId"), async (info) => {
      const transactionId = info.params.transactionId as string;
      return HttpResponse.json({
        ...yieldApiTransactionFixture({
          id: transactionId,
          type: "CLAIM_REWARDS",
          explorerUrl:
            "https://snowtrace.dev/tx/0x5c2e4ac81fa12b8e935e1cf5e39eda4594d75e82da0c9b44c6d85f20214452fb",
          network: avaxLiquidStaking.token.network,
          hash: "0x5c2e4ac81fa12b8e935e1cf5e39eda4594d75e82da0c9b44c6d85f20214452fb",
          status: "CONFIRMED",
        }),
      });
    })
  );

  let currentChainId = 43114;

  const getCurrentChainId = () => currentChainId;
  const setCurrentChainId = (chainId: number) => {
    currentChainId = chainId;
  };

  const requestFn = vitest.fn(
    async ({ method, params }: { method: string; params: unknown }) => {
      await waitForMs(500);

      switch (method) {
        case "eth_sendTransaction":
          return "transaction_hash";
        case "eth_chainId":
          return currentChainId;
        case "eth_requestAccounts":
          return [account];
        case "wallet_switchEthereumChain": {
          currentChainId = Just(params as { chainId: number }[])
            .map((val) => Number(val[0].chainId))
            .unsafeCoerce();

          return currentChainId;
        }
        default:
          throw new Error("unhandled method");
      }
    }
  );

  const customConnectors = rkMockWallet({ accounts: [account], requestFn });

  const setUrl = ({
    accountId,
    yieldId,
    pendingaction,
    network,
  }:
    | {
        yieldId: string;
        accountId: string;
        pendingaction?: string;
        network?: never;
      }
    | {
        network: string;
        yieldId?: never;
        accountId?: never;
        pendingaction?: never;
      }) => {
    return network
      ? _setUrl({ network })
      : _setUrl({ yieldId, accountId, pendingaction });
  };

  return {
    customConnectors,
    setUrl,
    avaxLiquidStaking,
    avaxNativeStaking,
    account,
    requestFn,
    setCurrentChainId,
    getCurrentChainId,
  };
};
