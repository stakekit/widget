import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import type { TokenBalanceScanResponseDto } from "../../src/domain/types/token-balance";
import type { TokenDto } from "../../src/domain/types/tokens";
import type { TokenWithAvailableYieldsDto as LegacyTokenWithAvailableYieldsDto } from "../../src/generated/api/legacy";
import type { TokenWithAvailableYieldsDto as YieldTokenWithAvailableYieldsDto } from "../../src/generated/api/yield";
import {
  fetchDefaultTokensPage,
  getDefaultTokens,
} from "../../src/hooks/api/use-default-tokens";
import type { ApiClient } from "../../src/providers/api/api-client";

const createToken = (symbol: string): TokenDto => ({
  name: symbol,
  symbol,
  decimals: 18,
  network: "ethereum",
  logoURI: `https://assets.stakek.it/tokens/${symbol.toLowerCase()}.svg`,
});

const createTokenWithYields = (
  symbol: string,
  yieldId = `${symbol.toLowerCase()}-yield`
): YieldTokenWithAvailableYieldsDto => ({
  token: createToken(symbol) as YieldTokenWithAvailableYieldsDto["token"],
  availableYields: [yieldId],
});

const createApiClient = ({
  getLegacyTokens = vi.fn(),
  getYieldTokens = vi.fn(),
}: {
  getLegacyTokens?: ReturnType<typeof vi.fn>;
  getYieldTokens?: ReturnType<typeof vi.fn>;
}) =>
  ({
    withOptions: () => ({
      legacy: {
        TokenControllerGetTokens: getLegacyTokens,
      },
      yield: {
        TokensControllerGetTokens: getYieldTokens,
      },
    }),
  }) as unknown as ApiClient;

describe("fetchDefaultTokensPage", () => {
  it("uses the yield API with network and yield type filters", async () => {
    const tokens = [
      createTokenWithYields("ETH", "eth-staking"),
      createTokenWithYields("SOL", "sol-staking"),
    ];
    const getLegacyTokens = vi.fn();
    const getYieldTokens = vi.fn(async () => ({
      items: tokens,
      total: 3,
      offset: 0,
      limit: 2,
    }));
    const apiClient = createApiClient({ getLegacyTokens, getYieldTokens });

    const page = await fetchDefaultTokensPage({
      apiClient,
      limit: 2,
      network: "ethereum",
      offset: 0,
      yieldTypes: ["staking"],
    });

    expect(page).toEqual({
      tokens: tokens.map(
        (tokenWithYields): TokenBalanceScanResponseDto => ({
          ...tokenWithYields,
          amount: "0",
        })
      ),
      nextOffset: 2,
    });
    expect(getLegacyTokens).not.toHaveBeenCalled();
    expect(getYieldTokens).toHaveBeenCalledWith({
      params: {
        networks: ["ethereum"],
        yieldTypes: ["staking"],
        offset: 0,
        limit: 2,
      },
    });
  });

  it("uses the legacy API when no enabled-yield filter is requested", async () => {
    const token = {
      token: createToken("ETH") as LegacyTokenWithAvailableYieldsDto["token"],
      availableYields: ["eth-staking"],
    };
    const getLegacyTokens = vi.fn(async () => [token]);
    const getYieldTokens = vi.fn();
    const apiClient = createApiClient({ getLegacyTokens, getYieldTokens });

    const page = await fetchDefaultTokensPage({
      apiClient,
      network: "ethereum",
    });

    expect(page.tokens).toEqual([{ ...token, amount: "0" }]);
    expect(page.nextOffset).toBeUndefined();
    expect(getYieldTokens).not.toHaveBeenCalled();
    expect(getLegacyTokens).toHaveBeenCalledWith({
      params: {
        enabledYieldsOnly: undefined,
        network: "ethereum",
      },
    });
  });
});

describe("getDefaultTokens", () => {
  it("fetches every page from the paginated yield API", async () => {
    const tokens = [
      createTokenWithYields("ETH"),
      createTokenWithYields("SOL"),
      createTokenWithYields("USDC"),
    ];
    const getYieldTokens = vi.fn(
      async ({ params }: { params: { offset?: number; limit?: number } }) => {
        const offset = params.offset ?? 0;
        const limit = params.limit ?? 2;

        return {
          items: tokens.slice(offset, offset + limit),
          total: tokens.length,
          offset,
          limit,
        };
      }
    );
    const apiClient = createApiClient({ getYieldTokens });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const result = await getDefaultTokens({
      apiClient,
      enabledYieldsOnly: true,
      limit: 2,
      network: "ethereum",
      queryClient,
    }).run();

    expect(result.unsafeCoerce().map((item) => item.token.symbol)).toEqual([
      "ETH",
      "SOL",
      "USDC",
    ]);
    expect(getYieldTokens.mock.calls.map(([arg]) => arg.params.offset)).toEqual(
      [0, 2]
    );
  });
});
