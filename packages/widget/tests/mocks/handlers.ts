import { getStakeKitMock } from "@stakekit/api-hooks/msw";
import { http, HttpResponse, delay, passthrough } from "msw";

export const handlers = [
  http.get("*/v1/actions/:actionId/gas-estimate", async () => {
    await delay();

    return new HttpResponse(null, { status: 400 });
  }),
  http.get("https://i18n.stakek.it/locales/en/errors.json", async () => {
    await delay();

    return HttpResponse.json({});
  }),

  http.get("*/v1/yields/enabled/networks", async () => {
    await delay();

    return HttpResponse.json([
      "ethereum",
      "ethereum-goerli",
      "avalanche-c",
      "celo",
      "akash",
      "cosmos",
      "kava",
      "osmosis",
      "juno",
      "stargaze",
      "persistence",
      "axelar",
      "onomy",
      "quicksilver",
      "agoric",
      "band-protocol",
      "bitsong",
      "chihuahua",
      "comdex",
      "crescent",
      "cronos",
      "cudos",
      "fetch-ai",
      "gravity-bridge",
      "injective",
      "irisnet",
      "ki-network",
      "mars-protocol",
      "regen",
      "secret",
      "sentinel",
      "sommelier",
      "teritori",
      "umee",
      "coreum",
      "desmos",
      "dydx",
      "optimism",
      "fantom",
      "arbitrum",
      "polygon",
      "binance",
      "near",
      "harmony",
      "solana",
      "tezos",
    ]);
  }),

  http.get("*/v1/tokens", async () => {
    await delay();

    return HttpResponse.json([
      {
        token: {
          network: "ethereum",
          name: "Ethereum",
          symbol: "ETH",
          decimals: 18,
          coinGeckoId: "ethereum",
          logoURI: "https://assets.stakek.it/tokens/eth.svg",
        },
        availableYields: [
          "ethereum-eth-etherfi-staking",
          "ethereum-eth-p2p-staking",
          "ethereum-eth-lido-staking",
          "ethereum-eth-stakewise-staking",
          "ethereum-eth-reth-staking",
          "ethereum-eth-everstake-staking",
          "ethereum-eth-figment-staking",
          "ethereum-renzo-ezeth-staking",
          "ethereum-eth-luganodes-staking",
        ],
      },
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
      {
        token: {
          name: "Celo",
          symbol: "CELO",
          decimals: 18,
          address: "0x471EcE3750Da237f93B8E339c536989b8978a438",
          network: "celo",
          coinGeckoId: "celo",
          logoURI: "https://assets.stakek.it/tokens/celo.svg",
        },
        availableYields: ["celo-celo-native-staking"],
      },
    ]);
  }),

  http.all("*", async () => {
    await delay();
    return passthrough();
  }),
  ...getStakeKitMock(),
];
