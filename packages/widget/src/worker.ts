import { HttpResponse, http } from "msw";
import { setupWorker } from "msw/browser";

const yieldId = "ethereum-matic-native-staking";

const maticToken = {
  address: "0x0000000000000000000000000000000000001010",
  symbol: "POL",
  name: "Polygon Ecosystem Token",
  decimals: 18,
  network: "ethereum",
  coinGeckoId: "matic-network",
  logoURI: "https://assets.stakek.it/tokens/matic.svg",
  isPoints: false,
};

const morphoToken = {
  address: "0x58d97b57bb95320f9a05dc918aef65434969c2b3",
  symbol: "MORPHO",
  name: "Morpho Token",
  decimals: 18,
  network: "ethereum",
  isPoints: false,
};

const campaignToken = {
  address: "0x58d97b57bb95320f9a05dc918aef65434969c2b2",
  symbol: "U",
  name: "United Stables",
  decimals: 18,
  network: "ethereum",
  isPoints: false,
};

const discoveryRewardRate = {
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
      token: campaignToken,
      yieldSource: "campaign_incentive",
      description: "U rewards",
    },
    {
      rate: 0.042668878941986094,
      rateType: "APY",
      token: campaignToken,
      yieldSource: "staking",
      description: "Native staking APY",
    },
  ],
};

const personalizedRewardRate = {
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
      token: campaignToken,
      yieldSource: "campaign_incentive",
      description: "U rewards",
    },
    {
      rate: 0.042668878941986094,
      rateType: "APY",
      token: campaignToken,
      yieldSource: "staking",
      description: "Native staking APY",
    },
  ],
};

const legacyYieldDto = {
  id: yieldId,
  token: maticToken,
  tokens: [maticToken],
  rewardRate: discoveryRewardRate.total,
  rewardType: "apy",
  apy: discoveryRewardRate.total,
  feeConfigurations: [],
  args: {
    enter: {
      addresses: {
        address: {
          required: true,
          network: "ethereum",
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
          network: "ethereum",
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
  metadata: {
    name: "Trust POL Staking",
    description: "Local mock for campaign APY QA",
    documentation: "https://trustwallet.com",
    logoURI: "https://assets.stakek.it/tokens/matic.svg",
    type: "staking",
    token: maticToken,
    tokens: [maticToken],
    rewardTokens: [campaignToken, morphoToken],
    rewardClaiming: "auto",
    rewardSchedule: "day",
    gasFeeToken: maticToken,
    fee: {
      enabled: false,
      depositFee: false,
      managementFee: false,
      performanceFee: false,
    },
    provider: {
      id: "benqi",
      name: "Trust",
      description: "",
      externalLink: "https://trustwallet.com",
      logoURI: "https://assets.stakek.it/providers/benqi.svg",
    },
    supportsLedgerWalletApi: true,
    supportsMultipleValidators: false,
  },
  status: {
    enter: true,
    exit: true,
  },
  validators: [],
};

const yieldApiYieldDto = {
  id: yieldId,
  token: maticToken,
  tokens: [maticToken],
  inputTokens: [maticToken],
  outputToken: maticToken,
  network: "ethereum",
  chainId: "1",
  providerId: "benqi",
  rewardRate: discoveryRewardRate,
  metadata: {
    name: "Trust POL Staking",
    description: "Local mock for campaign APY QA",
    documentation: "https://trustwallet.com",
    logoURI: "https://assets.stakek.it/tokens/matic.svg",
  },
  mechanics: {
    type: "staking",
    gasFeeToken: maticToken,
    rewardClaiming: "auto",
    rewardSchedule: "day",
    supportsLedgerWalletApi: true,
    requiresValidatorSelection: false,
    arguments: {
      enter: {
        fields: [
          {
            name: "amount",
            type: "string",
            label: "Amount",
            required: true,
            minimum: "0",
          },
        ],
      },
      exit: {
        fields: [
          {
            name: "amount",
            type: "string",
            label: "Amount",
            required: true,
            minimum: "0",
          },
        ],
      },
    },
  },
  status: {
    enter: true,
    exit: true,
  },
};

export const worker = setupWorker(
  http.get("*/v1/yields/ethereum-matic-native-staking", async ({ request }) => {
    const url = new URL(request.url);

    return HttpResponse.json(
      url.searchParams.has("ledgerWalletAPICompatible")
        ? legacyYieldDto
        : yieldApiYieldDto
    );
  }),
  http.post("*/v1/yields/balances", async () => {
    return HttpResponse.json({
      items: [
        {
          yieldId,
          balances: [
            {
              address: "0x15775b23340c0f50e0428d674478b0e9d3d0a759",
              amount: "1000251.8279906842",
              amountRaw: "10002518279906842",
              type: "active",
              token: maticToken,
              pendingActions: [],
              amountUsd: "1000355.009527",
              isEarning: true,
            },
          ],
          rewardRate: personalizedRewardRate,
        },
      ],
      errors: [],
    });
  }),
  http.post("*/v1/balances", async () => {
    return HttpResponse.json({
      items: [
        {
          yieldId,
          balances: [
            {
              address: "0x15775b23340c0f50e0428d674478b0e9d3d0a759",
              amount: "1000251.8279906842",
              amountRaw: "10002518279906842",
              type: "active",
              token: maticToken,
              pendingActions: [],
              amountUsd: "1000355.009527",
              isEarning: true,
            },
          ],
          rewardRate: personalizedRewardRate,
        },
      ],
      errors: [],
    });
  }),
  http.post("*/v1/actions/enter/estimate-gas", async () => {
    return HttpResponse.json({
      amount: "0.1",
      token: maticToken,
      gasLimit: "",
    });
  })
);
