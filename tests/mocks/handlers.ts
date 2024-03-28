import { delay, http, HttpResponse, passthrough } from "msw";
import { getStakeKitMock } from "@stakekit/api-hooks/msw";

export const handlers = [
  ...getStakeKitMock(),
  http.get("*/v1/actions/:actionId/gas-estimate", async () => {
    await delay();

    return new HttpResponse(null, { status: 400 });
  }),
  http.get("https://i18n.stakek.it/locales/en/errors.json", async () => {
    await delay();

    return HttpResponse.json({});
  }),
  http.options("*", async () => {
    await delay();
    return HttpResponse.json({
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "*",
    });
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

  http.all("*", async () => {
    await delay();
    return passthrough();
  }),
];
