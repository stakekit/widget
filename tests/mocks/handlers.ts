import { delay, http, HttpResponse, passthrough } from "msw";
import { getStakeKitMock } from "@stakekit/api-hooks";

export const handlers = [
  ...getStakeKitMock(),
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

  http.post("https://cloudflare-eth.com", async () => {
    await delay();
    return passthrough();
  }),
  http.post(`https://api.avax.network/ext/bc/C/rpc`, async () => {
    await delay();
    return passthrough();
  }),
  http.get("https://explorer-api.walletconnect.com/*", async () => {
    await delay();
    return passthrough();
  }),
  http.get("https://relay.walletconnect.com/", async () => {
    await delay();
    return passthrough();
  }),
  http.get("https://relay.walletconnect.org/", async () => {
    await delay();
    return passthrough();
  }),
  http.get("https://www.walletlink.org/rpc", async () => {
    await delay();
    return passthrough();
  }),
];
