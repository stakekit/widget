import { TokenDto, YieldBalanceDto, YieldDto } from "@stakekit/api-hooks";
import {
  getActionControllerPendingResponseMock,
  getTransactionControllerGetGasForNetworkResponseMock,
  getYieldControllerYieldOpportunityResponseMock,
} from "@stakekit/api-hooks/msw";
import { rkMockWallet } from "../../utils/mock-connector";
import { server } from "../../mocks/server";
import { HttpResponse, delay, http } from "msw";
import { Just } from "purify-ts";
import { vitest } from "vitest";
import { waitForMs } from "../../../src/utils";

export const setup = async (opts?: {
  withValidatorAddressesRequired?: boolean;
}) => {
  const account = "0xB6c5273e79E2aDD234EBC07d87F3824e0f94B2F7";

  const token: TokenDto = {
    name: "Avalanche C Chain",
    symbol: "AVAX",
    decimals: 18,
    network: "avalanche-c",
    coinGeckoId: "avalanche-2",
    logoURI: "https://assets.stakek.it/tokens/avax.svg",
  };

  const amount = "6.367499123588739454";

  const avaxNativeStaking = Just(
    getYieldControllerYieldOpportunityResponseMock()
  )
    .map(
      (def): YieldDto => ({
        ...def,
        id: "avalanche-avax-native-staking",
        token,
        tokens: [token],
        apy: 0.08486613028450002,
        rewardRate: 0.08486613028450002,
        rewardType: "apy",
        status: { enter: true, exit: true },
        metadata: { ...def.metadata, type: "staking" },
        validators: [],
      })
    )
    .unsafeCoerce();

  const avaxLiquidStaking = Just(
    getYieldControllerYieldOpportunityResponseMock()
  )
    .map(
      (def): YieldDto => ({
        ...def,
        id: "avalanche-avax-liquid-staking",
        token,
        tokens: [token],
        status: { enter: true, exit: true },
        rewardRate: 0.05766578328258792,
        apy: 0.05766578328258792,
        rewardType: "apy",
        metadata: {
          ...def.metadata,
          name: "AVAX Liquid Staking",
          type: "liquid-staking",
          provider: {
            id: "benqi",
            name: "Benqi",
            description: "",
            externalLink: "https://benqi.fi/",
            logoURI: "https://assets.stakek.it/providers/benqi.svg",
          },
          rewardTokens: [
            {
              name: "Staked AVAX",
              symbol: "sAVAX",
              decimals: 18,
              network: token.network,
              logoURI: "https://assets.stakek.it/tokens/savax.svg",
              address: "0x2b2c81e08f1af8835a78bb2a90ae924ace0ea4be",
            },
          ],
        },
        validators: opts?.withValidatorAddressesRequired
          ? [
              {
                address: "0xe92b7ba8497486e94bb59c51f595b590c4a5f894",
                status: "active",
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
          : [],
      })
    )
    .unsafeCoerce();

  const avaxLiquidStakingBalances: YieldBalanceDto[] = [
    {
      groupId: "b4684f63-fe54-540d-b0ae-06a2c2ecdb9e",
      type: "rewards",
      amount: "0.019258000000000000",
      pendingActions: [
        {
          args: {
            args: {
              validatorAddresses: {
                required: !!opts?.withValidatorAddressesRequired,
              },
            },
          },
          type: "CLAIM_REWARDS",
          passthrough:
            "eyJhZGRyZXNzZXMiOnsiYWRkcmVzcyI6IlRTWjFBazlaVjNOam1Wd3NUejNxMnNuYzdYR1FFSlZTRUQifX0=",
        },
      ],
      pricePerShare: "1",
      token: avaxLiquidStaking.token,
    },
  ];

  const pendingAction = Just(getActionControllerPendingResponseMock())
    .map((def): typeof def => ({
      ...def,
      type: "CLAIM_REWARDS",
      transactions: [
        {
          ...def.transactions[0],
          type: "CLAIM_REWARDS",
          id: "be6f79f6-938e-48e5-bc38-8f7485d6ea67",
          status: "CREATED",
        },
      ],
    }))
    .unsafeCoerce();

  server.use(
    http.get("*/v1/yields/enabled/networks", async () => {
      await delay();
      return HttpResponse.json([token.network]);
    }),

    http.post("*/v1/tokens/balances/scan", async () => {
      await delay();
      return HttpResponse.json([
        {
          token,
          amount,
          availableYields: [avaxNativeStaking.id, avaxLiquidStaking.id],
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
    http.get(`*/v1/yields/${avaxNativeStaking.id}`, async () => {
      await delay();
      return HttpResponse.json(avaxNativeStaking);
    }),
    http.get(`*/v1/yields/${avaxLiquidStaking.id}`, async () => {
      await delay();
      return HttpResponse.json(avaxLiquidStaking);
    }),
    http.post("*/v1/yields/balances/scan", async () => {
      await delay();
      return HttpResponse.json([
        {
          balances: avaxLiquidStakingBalances,
          integrationId: avaxLiquidStaking.id,
        },
      ]);
    }),
    http.post(`*/v1/yields/${avaxNativeStaking.id}/balances/scan`, async () => {
      await delay();
      return HttpResponse.json({
        integrationId: avaxLiquidStaking.id,
        balances: avaxLiquidStakingBalances,
      });
    }),
    http.post(`*/v1/yields/${avaxLiquidStaking.id}/balances`, async () => {
      await delay();
      return HttpResponse.json(avaxLiquidStakingBalances);
    }),
    http.get(
      `*/v1/transactions/gas/${avaxLiquidStaking.token.network}`,
      async () => {
        await delay();
        return HttpResponse.json(
          getTransactionControllerGetGasForNetworkResponseMock()
        );
      }
    ),
    http.post("*/v1/actions/pending", async () => {
      await delay();
      return HttpResponse.json(pendingAction);
    }),
    http.patch(`*/v1/transactions/:transactionId`, async (info) => {
      await delay();

      const transactionId = info.params.transactionId as string;

      return HttpResponse.json({
        ...pendingAction.transactions[0],
        type: "CLAIM_REWARDS",
        status: "WAITING_FOR_SIGNATURE",
        id: transactionId,
        unsignedTransaction:
          '{"from":"0xcaA141ece9fEE66D15f0257F5c6C48E26784345C","gasLimit":"0x0193e0","to":"0x7D2382b1f8Af621229d33464340541Db362B4907","data":"0x00f714ce00000000000000000000000000000000000000000000000000037cb07e6e4276000000000000000000000000caa141ece9fee66d15f0257f5c6c48e26784345c","nonce":89,"type":2,"maxFeePerGas":"0xbfa6de","maxPriorityFeePerGas":"0x0f4240","chainId":43114}',
      });
    }),
    http.post("*/v1/transactions/:transactionId/submit_hash", async () => {
      await delay(1000);
      return new HttpResponse(null, { status: 201 });
    }),
    http.get("*/v1/transactions/:transactionId/status", async () => {
      return HttpResponse.json({
        url: "https://snowtrace.dev/tx/0x5c2e4ac81fa12b8e935e1cf5e39eda4594d75e82da0c9b44c6d85f20214452fb",
        network: avaxLiquidStaking.token.network,
        hash: "0x5c2e4ac81fa12b8e935e1cf5e39eda4594d75e82da0c9b44c6d85f20214452fb",
        status: "CONFIRMED",
      });
    })
  );

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

  const setUrl = ({
    accountId,
    yieldId,
    pendingaction,
  }: {
    yieldId: string;
    accountId: string;
    pendingaction?: string;
  }) => {
    const url = new URL(
      `http://localhost:5173/?yieldId=${yieldId}&accountId=${accountId}&pendingaction=${pendingaction}`
    );

    Object.defineProperty(window, "location", {
      value: {
        href: url.href,
        hostname: url.hostname,
        origin: url.origin,
      },
    });

    return {
      origin: url.origin,
      url,
    };
  };

  return {
    customConnectors,
    setUrl,
    avaxLiquidStaking,
    avaxNativeStaking,
    account,
    requestFn,
  };
};
