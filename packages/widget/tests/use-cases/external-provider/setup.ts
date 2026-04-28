import { delay, HttpResponse, http } from "msw";
import { Just } from "purify-ts";
import {
  yieldApiYieldFixtureFromLegacy,
  yieldFixture,
  yieldValidatorsFixture,
} from "../../fixtures";
import { legacyApiRoute, yieldApiRoute } from "../../mocks/api-routes";
import { worker } from "../../mocks/worker";

type LegacyTokenDto = ReturnType<typeof yieldFixture>["token"];

export const setup = () => {
  const avalancheCToken: LegacyTokenDto = {
    name: "Avalanche C Chain",
    symbol: "AVAX",
    decimals: 18,
    network: "avalanche-c",
    coinGeckoId: "avalanche-2",
    logoURI: "https://assets.stakek.it/tokens/avax.svg",
  };

  const ether: LegacyTokenDto = {
    network: "ethereum",
    name: "Ethereum",
    symbol: "ETH",
    decimals: 18,
    coinGeckoId: "ethereum",
    logoURI: "https://assets.stakek.it/tokens/eth.svg",
  };

  const solanaToken: LegacyTokenDto = {
    network: "solana",
    name: "Solana",
    symbol: "SOL",
    decimals: 9,
    coinGeckoId: "solana",
    logoURI: "https://assets.stakek.it/tokens/sol.svg",
  };

  const tonToken: LegacyTokenDto = {
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
          validators: [],
          metadata: {
            ...val.metadata,
            type: "staking",
            gasFeeToken: avalancheCToken,
          },
        }) satisfies ReturnType<typeof yieldFixture>
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
          validators: [],
          metadata: {
            ...val.metadata,
            type: "staking",
            gasFeeToken: ether,
          },
        }) satisfies ReturnType<typeof yieldFixture>
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
          validators: [],
          metadata: {
            ...val.metadata,
            type: "staking",
            gasFeeToken: solanaToken,
          },
        }) satisfies ReturnType<typeof yieldFixture>
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
          validators: [],
          metadata: {
            ...val.metadata,
            type: "staking",
            gasFeeToken: tonToken,
          },
        }) satisfies ReturnType<typeof yieldFixture>
    )
    .unsafeCoerce();

  const etherNativeStakingYieldApi = yieldApiYieldFixtureFromLegacy({
    legacyYield: etherNativeStaking,
  });
  const avalancheAvaxNativeStakingYieldApi = yieldApiYieldFixtureFromLegacy({
    legacyYield: avalancheAvaxNativeStaking,
  });
  const solanaNativeStakingYieldApi = yieldApiYieldFixtureFromLegacy({
    legacyYield: solanaNativeStaking,
  });
  const tonNativeStakingYieldApi = yieldApiYieldFixtureFromLegacy({
    legacyYield: tonNativeStaking,
  });

  worker.use(
    http.get(yieldApiRoute("/v1/networks"), async () => {
      await delay();
      return HttpResponse.json([
        { id: etherNativeStaking.token.network },
        { id: avalancheAvaxNativeStaking.token.network },
        { id: solanaNativeStaking.token.network },
        { id: tonNativeStaking.token.network },
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

    http.get(
      legacyApiRoute(`/v1/yields/${etherNativeStaking.id}`),
      async () => {
        await delay();

        return HttpResponse.json(etherNativeStaking);
      }
    ),
    http.get(yieldApiRoute(`/v1/yields/${etherNativeStaking.id}`), async () => {
      await delay();

      return HttpResponse.json(etherNativeStakingYieldApi);
    }),
    http.get(
      legacyApiRoute(`/v1/yields/${avalancheAvaxNativeStaking.id}`),
      async () => {
        await delay();

        return HttpResponse.json(avalancheAvaxNativeStaking);
      }
    ),
    http.get(
      yieldApiRoute(`/v1/yields/${avalancheAvaxNativeStaking.id}`),
      async () => {
        await delay();

        return HttpResponse.json(avalancheAvaxNativeStakingYieldApi);
      }
    ),
    http.get(
      legacyApiRoute(`/v1/yields/${solanaNativeStaking.id}`),
      async () => {
        await delay();

        return HttpResponse.json(solanaNativeStaking);
      }
    ),
    http.get(
      yieldApiRoute(`/v1/yields/${solanaNativeStaking.id}`),
      async () => {
        await delay();

        return HttpResponse.json(solanaNativeStakingYieldApi);
      }
    ),
    http.get(legacyApiRoute(`/v1/yields/${tonNativeStaking.id}`), async () => {
      await delay();

      return HttpResponse.json(tonNativeStaking);
    }),
    http.get(yieldApiRoute(`/v1/yields/${tonNativeStaking.id}`), async () => {
      await delay();

      return HttpResponse.json(tonNativeStakingYieldApi);
    }),
    http.get("*/v1/yields/:yieldId/validators", async (info) => {
      await delay();

      const yieldId = info.params.yieldId as string;
      const validatorsByYieldId = new Map<
        string,
        ReturnType<typeof yieldFixture>["validators"]
      >([
        [etherNativeStaking.id, etherNativeStaking.validators],
        [avalancheAvaxNativeStaking.id, avalancheAvaxNativeStaking.validators],
        [solanaNativeStaking.id, solanaNativeStaking.validators],
        [tonNativeStaking.id, tonNativeStaking.validators],
      ]);
      const validators = yieldValidatorsFixture(
        validatorsByYieldId.get(yieldId) ?? []
      );

      return HttpResponse.json({
        items: validators,
        total: validators.length,
      });
    })
  );
};
