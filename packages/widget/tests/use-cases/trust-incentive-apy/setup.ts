import { delay, HttpResponse, http } from "msw";
import { avalanche } from "viem/chains";
import { vitest } from "vitest";
import type {
  YieldDto as YieldApiYieldDto,
  YieldBalanceDto,
  YieldRewardRateDto,
} from "../../../src/providers/yield-api-client-provider/types";
import { waitForMs } from "../../../src/utils";
import {
  yieldApiYieldFixture,
  yieldBalanceFixture,
  yieldFixture,
  yieldRewardRateFixture,
} from "../../fixtures";
import { worker } from "../../mocks/worker";
import { rkMockWallet } from "../../utils/mock-connector";

type LegacyTokenDto = ReturnType<typeof yieldFixture>["token"];

const setUrl = ({
  accountId,
  balanceId,
  yieldId,
}: {
  accountId?: string;
  balanceId?: string;
  yieldId?: string;
}) => {
  const searchParams = new URLSearchParams();

  if (accountId) {
    searchParams.set("accountId", accountId);
  }

  if (balanceId) {
    searchParams.set("balanceId", balanceId);
  }

  if (yieldId) {
    searchParams.set("yieldId", yieldId);
  }

  const url = new URL(window.location.href);
  url.search = searchParams.toString();
  window.history.pushState({}, "", url);
};

export const setup = async () => {
  const account = "0xB6c5273e79E2aDD234EBC07d87F3824e0f94B2F7";

  const token: LegacyTokenDto = {
    name: "USDA",
    symbol: "USDA",
    decimals: 18,
    network: "avalanche-c",
    coinGeckoId: "angle-usd",
    logoURI: "https://assets.stakek.it/tokens/usda.svg",
  };

  const rewardToken: LegacyTokenDto = {
    name: "United Stables",
    symbol: "U",
    decimals: 18,
    network: token.network,
    address: "0x58D97B57BB95320F9a05dC918Aef65434969c2B2",
    logoURI: "https://assets.stakek.it/tokens/usda.svg",
  };

  const morphoToken: LegacyTokenDto = {
    name: "Morpho Token",
    symbol: "MORPHO",
    decimals: 18,
    network: token.network,
    address: "0x58D97B57BB95320F9a05dC918Aef65434969c2B3",
    logoURI: "https://assets.stakek.it/tokens/usda.svg",
  };

  const discoveryRewardRate: YieldRewardRateDto = yieldRewardRateFixture({
    total: 0.045507546653006034,
    rateType: "APY",
    components: [
      {
        rate: 0.0028386677110199426,
        rateType: "APR",
        token: morphoToken,
        yieldSource: "protocol_incentive",
        description: "MORPHO rewards",
      },
      {
        rate: 0.002,
        rateType: "APR",
        token: rewardToken,
        yieldSource: "campaign_incentive",
        description: "U rewards",
      },
      {
        rate: 0.042668878941986094,
        rateType: "APY",
        token: rewardToken,
        yieldSource: "vault",
        description: "Supply APY",
      },
    ],
  });

  const personalizedRewardRate: YieldRewardRateDto = yieldRewardRateFixture({
    total: 0.04530754665300604,
    rateType: "APY",
    components: [
      {
        rate: 0.0028386677110199426,
        rateType: "APR",
        token: morphoToken,
        yieldSource: "protocol_incentive",
        description: "MORPHO rewards",
      },
      {
        rate: 0.0018,
        rateType: "APR",
        token: rewardToken,
        yieldSource: "campaign_incentive",
        description: "U rewards",
      },
      {
        rate: 0.042668878941986094,
        rateType: "APY",
        token: rewardToken,
        yieldSource: "vault",
        description: "Supply APY",
      },
    ],
  });

  const yieldId =
    "avalanche-c-usda-trust-0xbeefa1abfebe621df50ceaef9f54fdb73648c92c-vault";

  const legacyYieldBase = yieldFixture();
  const rawYieldBase = yieldApiYieldFixture();

  const legacyYield: ReturnType<typeof yieldFixture> = {
    ...legacyYieldBase,
    id: yieldId,
    token,
    tokens: [token],
    rewardRate: discoveryRewardRate.total,
    rewardType: "apy",
    apy: discoveryRewardRate.total,
    validators: [],
    feeConfigurations: [],
    args: {
      enter: {
        args: {
          amount: {
            required: true,
            minimum: 0,
          },
        },
      },
      exit: {
        args: {
          amount: {
            required: true,
            minimum: 0,
          },
        },
      },
    },
    metadata: {
      ...legacyYieldBase.metadata,
      name: "Trust USDA Earn",
      type: "vault",
      token,
      rewardTokens: undefined,
      gasFeeToken: token,
      provider: {
        id: legacyYieldBase.metadata.provider?.id ?? "benqi",
        name: "Trust",
        description: "",
        externalLink: "https://trustwallet.com",
        logoURI: "https://assets.stakek.it/providers/benqi.svg",
      },
    },
    status: {
      enter: true,
      exit: true,
    },
  };

  const rawYield: YieldApiYieldDto = {
    ...rawYieldBase,
    id: yieldId,
    token,
    tokens: [token],
    inputTokens: [token],
    outputToken: {
      ...token,
      symbol: "steakUSDA",
      name: "Steakhouse USDA",
    },
    network: token.network,
    chainId: `${avalanche.id}`,
    providerId: rawYieldBase.providerId,
    rewardRate: discoveryRewardRate,
    metadata: {
      ...(rawYieldBase.metadata ?? {}),
      name: "Trust USDA Earn",
      description: "Trust campaign vault",
      logoURI: "https://assets.stakek.it/providers/benqi.svg",
    },
    mechanics: {
      ...(rawYieldBase.mechanics ?? {}),
      type: "vault",
      gasFeeToken: token,
      rewardClaiming: "auto",
      rewardSchedule: "day",
      requiresValidatorSelection: false,
      supportsLedgerWalletApi: true,
    },
    status: {
      enter: true,
      exit: true,
    },
  };

  const activeBalance: YieldBalanceDto = yieldBalanceFixture({
    address: account,
    type: "active",
    amount: "1000251.8279906842",
    amountRaw: "1000251827990684200000000",
    amountUsd: "1000355.009527",
    isEarning: true,
    token,
    pendingActions: [],
  });

  worker.use(
    http.get("*/v1/yields/enabled/networks", async () => {
      await delay();
      return HttpResponse.json([token.network]);
    }),
    http.get("*/v1/tokens", async () => {
      await delay();
      return HttpResponse.json([
        {
          token,
          availableYields: [yieldId],
        },
      ]);
    }),
    http.post("*/v1/tokens/balances/scan", async () => {
      await delay();
      return HttpResponse.json([
        {
          token,
          amount: "1000251.8279906842",
          availableYields: [yieldId],
        },
      ]);
    }),
    http.post("*/v1/tokens/balances", async () => {
      await delay();
      return HttpResponse.json([
        {
          token,
          amount: "1000251.8279906842",
        },
      ]);
    }),
    http.post("*/v1/tokens/prices", async () => {
      await delay();
      return HttpResponse.json({
        "avalanche-c-undefined": {
          price: 1,
          price_24_h: 0,
        },
      });
    }),
    http.get(`*/v1/yields/${yieldId}`, async ({ request }) => {
      await delay();

      const url = new URL(request.url);

      return HttpResponse.json(
        url.searchParams.has("ledgerWalletAPICompatible")
          ? legacyYield
          : rawYield,
      );
    }),
    http.get("*/v1/yields/:yieldId/validators", async () => {
      await delay();
      return HttpResponse.json({
        items: [],
        total: 0,
      });
    }),
    http.post("*/v1/yields/balances", async () => {
      await delay();
      return HttpResponse.json({
        items: [
          {
            yieldId,
            balances: [activeBalance],
            rewardRate: personalizedRewardRate,
          },
        ],
        errors: [],
      });
    }),
  );

  const requestFn = vitest.fn(async ({ method }: { method: string }) => {
    await waitForMs(100);

    switch (method) {
      case "eth_chainId":
        return avalanche.id;
      case "eth_requestAccounts":
        return [account];
      default:
        throw new Error("unhandled method");
    }
  });

  const customConnectors = rkMockWallet({ accounts: [account], requestFn });

  return {
    account,
    customConnectors,
    setUrl,
    legacyYield,
    discoveryRewardRate,
    personalizedRewardRate,
  };
};
