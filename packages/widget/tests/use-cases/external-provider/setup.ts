import type { TokenDto, YieldDto } from "@stakekit/api-hooks";
import { delay, HttpResponse, http } from "msw";
import { Just } from "purify-ts";
import { yieldFixture } from "../../fixtures";
import { worker } from "../../mocks/worker";

export const setup = () => {
  const avalancheCToken: TokenDto = {
    name: "Avalanche C Chain",
    symbol: "AVAX",
    decimals: 18,
    network: "avalanche-c",
    coinGeckoId: "avalanche-2",
    logoURI: "https://assets.stakek.it/tokens/avax.svg",
  };

  const ether: TokenDto = {
    network: "ethereum",
    name: "Ethereum",
    symbol: "ETH",
    decimals: 18,
    coinGeckoId: "ethereum",
    logoURI: "https://assets.stakek.it/tokens/eth.svg",
  };

  const solanaToken: TokenDto = {
    network: "solana",
    name: "Solana",
    symbol: "SOL",
    decimals: 9,
    coinGeckoId: "solana",
    logoURI: "https://assets.stakek.it/tokens/sol.svg",
  };

  const tonToken: TokenDto = {
    network: "ton",
    name: "Toncoin",
    symbol: "TON",
    decimals: 9,
    coinGeckoId: "the-open-network",
    logoURI: "https://assets.stakek.it/tokens/ton.svg",
  };

  const avalancheAvaxNativeStaking = Just(yieldFixture())
    .map(
      (val) =>
        ({
          ...val,
          id: "avalanche-avax-native-staking",
          token: avalancheCToken,
          tokens: [avalancheCToken],
          metadata: {
            ...val.metadata,
            type: "staking",
            gasFeeToken: avalancheCToken,
          },
        }) satisfies YieldDto
    )
    .unsafeCoerce();

  const etherNativeStaking = Just(yieldFixture())
    .map(
      (val) =>
        ({
          ...val,
          id: "ethereum-eth-etherfi-staking",
          token: ether,
          tokens: [ether],
          metadata: {
            ...val.metadata,
            type: "staking",
            gasFeeToken: ether,
          },
        }) satisfies YieldDto
    )
    .unsafeCoerce();

  const solanaNativeStaking = Just(yieldFixture())
    .map(
      (val) =>
        ({
          ...val,
          id: "solana-sol-native-staking",
          token: solanaToken,
          tokens: [solanaToken],
          metadata: {
            ...val.metadata,
            type: "staking",
            gasFeeToken: solanaToken,
          },
        }) satisfies YieldDto
    )
    .unsafeCoerce();

  const tonNativeStaking = Just(yieldFixture())
    .map(
      (val) =>
        ({
          ...val,
          id: "ton-native-staking",
          token: tonToken,
          tokens: [tonToken],
          metadata: {
            ...val.metadata,
            type: "staking",
            gasFeeToken: tonToken,
          },
        }) satisfies YieldDto
    )
    .unsafeCoerce();

  worker.use(
    http.get("*/v1/yields/enabled/networks", async () => {
      await delay();
      return HttpResponse.json([
        etherNativeStaking.token.network,
        avalancheAvaxNativeStaking.token.network,
        solanaNativeStaking.token.network,
        tonNativeStaking.token.network,
      ]);
    }),

    http.get("*/v1/tokens", async () => {
      await delay();

      return HttpResponse.json([
        { token: ether, availableYields: [etherNativeStaking.id] },
        {
          token: avalancheCToken,
          availableYields: [avalancheAvaxNativeStaking.id],
        },
        { token: solanaToken, availableYields: [solanaNativeStaking.id] },
        { token: tonToken, availableYields: [tonNativeStaking.id] },
      ]);
    }),

    http.post("*/v1/tokens/balances/scan", async () => {
      await delay();
      return HttpResponse.json([
        {
          token: ether,
          amount: "3",
          availableYields: [etherNativeStaking.id],
        },
        {
          token: avalancheCToken,
          amount: "3",
          availableYields: [avalancheAvaxNativeStaking.id],
        },
        {
          token: solanaToken,
          amount: "3",
          availableYields: [solanaNativeStaking.id],
        },
        {
          token: tonToken,
          amount: "3",
          availableYields: [tonNativeStaking.id],
        },
      ]);
    }),

    http.get(`*/v1/yields/${etherNativeStaking.id}`, async () => {
      await delay();

      return HttpResponse.json(etherNativeStaking);
    }),
    http.get(`*/v1/yields/${avalancheAvaxNativeStaking.id}`, async () => {
      await delay();

      return HttpResponse.json(avalancheAvaxNativeStaking);
    }),
    http.get(`*/v1/yields/${solanaNativeStaking.id}`, async () => {
      await delay();

      return HttpResponse.json(solanaNativeStaking);
    }),
    http.get(`*/v1/yields/${tonNativeStaking.id}`, async () => {
      await delay();

      return HttpResponse.json(tonNativeStaking);
    })
  );
};
