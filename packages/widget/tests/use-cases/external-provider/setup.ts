import { delay, HttpResponse, http } from "msw";
import {
  legacyYieldFixture,
  yieldApiValidatorsFixture,
  yieldApiYieldFixture,
} from "../../fixtures";
import { legacyApiRoute, yieldApiRoute } from "../../mocks/api-routes";
import type { TestWorker } from "../../utils/test-extend";

type LegacyTokenDto = ReturnType<typeof legacyYieldFixture>["token"];

export const setup = (worker: TestWorker) => {
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

  const legacyYieldBase = legacyYieldFixture();
  const yieldApiYieldBase = yieldApiYieldFixture();
  const createLegacyNativeStaking = ({
    id,
    token,
  }: {
    id: string;
    token: LegacyTokenDto;
  }) =>
    legacyYieldFixture({
      id,
      token,
      tokens: [token],
      validators: [],
      metadata: {
        ...legacyYieldBase.metadata,
        type: "staking",
        gasFeeToken: token,
      },
    });
  const createYieldApiNativeStaking = ({
    id,
    token,
  }: {
    id: string;
    token: LegacyTokenDto;
  }) =>
    yieldApiYieldFixture({
      id,
      network: token.network,
      token,
      tokens: [token],
      inputTokens: [token],
      outputToken: token,
      mechanics: {
        ...yieldApiYieldBase.mechanics,
        type: "staking",
        gasFeeToken: token,
      },
    });

  const avalancheAvaxNativeStaking = createLegacyNativeStaking({
    id: "avalanche-avax-native-staking",
    token: avalancheCToken,
  });
  const etherNativeStaking = createLegacyNativeStaking({
    id: "ethereum-eth-etherfi-staking",
    token: ether,
  });
  const solanaNativeStaking = createLegacyNativeStaking({
    id: "solana-sol-native-staking",
    token: solanaToken,
  });
  const tonNativeStaking = createLegacyNativeStaking({
    id: "ton-native-staking",
    token: tonToken,
  });

  const etherNativeStakingYieldApi = createYieldApiNativeStaking({
    id: etherNativeStaking.id,
    token: ether,
  });
  const avalancheAvaxNativeStakingYieldApi = createYieldApiNativeStaking({
    id: avalancheAvaxNativeStaking.id,
    token: avalancheCToken,
  });
  const solanaNativeStakingYieldApi = createYieldApiNativeStaking({
    id: solanaNativeStaking.id,
    token: solanaToken,
  });
  const tonNativeStakingYieldApi = createYieldApiNativeStaking({
    id: tonNativeStaking.id,
    token: tonToken,
  });

  worker.use(
    http.get(legacyApiRoute("/v1/yields/enabled/networks"), async () => {
      await delay();
      return HttpResponse.json([
        etherNativeStaking.token.network,
        avalancheAvaxNativeStaking.token.network,
        solanaNativeStaking.token.network,
        tonNativeStaking.token.network,
      ]);
    }),

    http.get(legacyApiRoute("/v1/tokens"), async () => {
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

    http.post(legacyApiRoute("/v1/tokens/balances/scan"), async () => {
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
    http.get(yieldApiRoute("/v1/yields/:yieldId/validators"), async () => {
      await delay();

      const validators = yieldApiValidatorsFixture([]);

      return HttpResponse.json({
        items: validators,
        total: validators.length,
        offset: 0,
        limit: 20,
      });
    })
  );
};
