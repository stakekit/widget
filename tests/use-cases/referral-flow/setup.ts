import type { TokenDto, YieldDto } from "@stakekit/api-hooks";
import { Networks } from "@stakekit/api-hooks";
import { http, HttpResponse, delay } from "msw";
import { server } from "../../mocks/server";
import { rkMockWallet } from "../../utils/mock-connector";

export const setup = () => {
  const account = "0xB6c5273e79E2aDD234EBC07d87F3824e0f94B2F7";
  const validReferral = "bgdCZB";
  const invalidReferral = "wrongR";
  const validAddressAndNetwork = {
    address: account,
    network: Networks["avalanche-c"],
  };
  const referralCodeRes = { id: "aaa-bbb", code: "czBG45" };

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

  server.use(
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
    http.get("*/v1/yields/enabled/networks", async () => {
      await delay();
      return HttpResponse.json(["avalanche-c"]);
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
    // Validate referral code
    http.get<
      { referralCode: string },
      never,
      { message: string } | typeof referralCodeRes
    >("*/v1/referrals/:referralCode", async (info) => {
      await delay(3000);

      if (info.params.referralCode !== validReferral) {
        return HttpResponse.json(
          { message: "MissingArgumentsError" },
          { status: 400, statusText: "Not valid" }
        );
      }

      return HttpResponse.json(referralCodeRes);
    }),

    // Get referral code for address
    http.get(
      "*/v1/networks/:networkSlug/addresses/:address/referrals",
      async (info) => {
        await delay();

        const networkSlug = info.params.networkSlug;
        const address = info.params.address;

        if (
          networkSlug === validAddressAndNetwork.network &&
          address === validAddressAndNetwork.address
        ) {
          return HttpResponse.json(referralCodeRes);
        }

        return new HttpResponse(null, { status: 404, statusText: "Not found" });
      }
    ),

    // ...If we couldn't get one, generate referral code for address
    http.post(
      "*/v1/networks/:networkSlug/addresses/:address/referrals",
      async () => {
        await delay();

        return HttpResponse.json(referralCodeRes);
      }
    ),
    http.get("https://i18n.stakek.it/locales/en/errors.json", async () => {
      await delay();

      return HttpResponse.json({
        MissingArgumentsError: {
          title: "Missing Arguments",
          details:
            "The following required arguments are missing to perform this operation: {{arguments}}",
          solution: "Try again later or contact Stakekit support",
        },
      });
    })
  );

  const setUrl = (referralCode?: string) => {
    const url = new URL(
      referralCode
        ? `http://localhost:5173/?ref=${referralCode}`
        : "http://localhost:5173/"
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

  const customConnectors = rkMockWallet({ accounts: [account] });

  return {
    customConnectors,
    validReferral,
    invalidReferral,
    validAddressAndNetwork,
    referralCodeRes,
    setUrl,
    account,
  };
};
