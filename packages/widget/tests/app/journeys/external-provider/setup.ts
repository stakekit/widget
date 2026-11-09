import { HttpResponse, http } from "msw";

import {
  yieldApiValidatorsFixture,
  yieldApiYieldDtoFixture,
} from "../../../fixtures";
import type { TokenDto as LegacyTokenDto } from "../../../generated/legacy-api-types";
import { legacyApiRoute, yieldApiRoute } from "../../../mocks/api-routes";
import { mockDelay } from "../../../mocks/delay";
import type { TestWorker } from "../../../utils/test-extend";

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

  const yieldApiYieldBase = yieldApiYieldDtoFixture();
  const createNativeStaking = ({
    id,
    token,
  }: {
    id: string;
    token: LegacyTokenDto;
  }) =>
    yieldApiYieldDtoFixture({
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

  const avalancheAvaxNativeStaking = createNativeStaking({
    id: "avalanche-avax-native-staking",
    token: avalancheCToken,
  });
  const etherNativeStaking = createNativeStaking({
    id: "ethereum-eth-etherfi-staking",
    token: ether,
  });
  const solanaNativeStaking = createNativeStaking({
    id: "solana-sol-native-staking",
    token: solanaToken,
  });
  const tonNativeStaking = createNativeStaking({
    id: "ton-native-staking",
    token: tonToken,
  });

  worker.use(
    http.get(yieldApiRoute("/v1/networks"), async () => {
      await mockDelay();
      return HttpResponse.json([
        { id: etherNativeStaking.token.network },
        { id: avalancheAvaxNativeStaking.token.network },
        { id: solanaNativeStaking.token.network },
        { id: tonNativeStaking.token.network },
      ]);
    }),

    http.get(legacyApiRoute("/v1/tokens"), async () => {
      await mockDelay();

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

    http.get(
      legacyApiRoute("/v2/networks/:network/addresses/:address/tokens"),
      async () => {
        await mockDelay();
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
      }
    ),

    ...[
      etherNativeStaking,
      avalancheAvaxNativeStaking,
      solanaNativeStaking,
      tonNativeStaking,
    ].map((yieldDto) =>
      http.get(yieldApiRoute(`/v1/yields/${yieldDto.id}`), async () => {
        await mockDelay();

        return HttpResponse.json(yieldDto);
      })
    ),
    http.get(yieldApiRoute("/v1/yields/:yieldId/validators"), async () => {
      await mockDelay();

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
