import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import type { TokenBalanceScanResponseDto } from "../../src/domain/types/token-balance";
import type { TokenDto } from "../../src/domain/types/tokens";
import type { TokenWithAvailableYieldsDto as LegacyTokenWithAvailableYieldsDto } from "../../src/generated/api/legacy";
import type { TokenWithAvailableYieldsDto as YieldTokenWithAvailableYieldsDto } from "../../src/generated/api/yield";
import {
  fetchDefaultTokens,
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

describe("fetchDefaultTokens", () => {
  it("uses the yield API with network and yield type filters", async () => {
    const tokens = [
      createTokenWithYields("ETH", "eth-staking"),
      createTokenWithYields("SOL", "sol-staking"),
      createTokenWithYields("USDC", "usdc-staking"),
    ];
    const getLegacyTokens = vi.fn();
    const getYieldTokens = vi.fn(async ({ params }) => ({
      items: tokens.slice(params.offset, params.offset + params.limit),
      total: tokens.length,
      offset: params.offset,
      limit: params.limit,
    }));
    const apiClient = createApiClient({ getLegacyTokens, getYieldTokens });

    const { pages } = await fetchDefaultTokens({
      apiClient,
      limit: 2,
      network: "ethereum",
      offset: 0,
      yieldTypes: ["staking"],
    });

    expect(pages).toHaveLength(2);
    expect(pages[0]).toMatchObject({
      limit: 2,
      tokens: tokens.slice(0, 2).map(
        (tokenWithYields): TokenBalanceScanResponseDto => ({
          ...tokenWithYields,
          amount: "0",
        })
      ),
      nextOffset: 2,
      offset: 0,
      total: 3,
    });
    expect(pages[1].tokens).toEqual(
      [tokens[2]].map((tokenWithYields) => ({
        ...tokenWithYields,
        amount: "0",
      }))
    );
    expect(getLegacyTokens).not.toHaveBeenCalled();
    expect(getYieldTokens.mock.calls.map(([arg]) => arg.params.offset)).toEqual(
      [0, 2]
    );
  });

  it("uses the legacy API when no enabled-yield filter is requested", async () => {
    const token = {
      token: createToken("ETH") as LegacyTokenWithAvailableYieldsDto["token"],
      availableYields: ["eth-staking"],
    };
    const getLegacyTokens = vi.fn(async () => [token]);
    const getYieldTokens = vi.fn();
    const apiClient = createApiClient({ getLegacyTokens, getYieldTokens });

    const { pages } = await fetchDefaultTokens({
      apiClient,
      network: "ethereum",
    });

    expect(pages).toHaveLength(1);
    expect(pages[0].tokens).toEqual([{ ...token, amount: "0" }]);
    expect(pages[0].nextOffset).toBeUndefined();
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
      createTokenWithYields("ATOM"),
      createTokenWithYields("OSMO"),
    ];
    let activePageRequests = 0;
    let maxActivePageRequests = 0;
    const getYieldTokens = vi.fn(
      async ({ params }: { params: { offset?: number; limit?: number } }) => {
        const offset = params.offset ?? 0;
        const limit = params.limit ?? 2;

        if (offset > 0) {
          activePageRequests += 1;
          maxActivePageRequests = Math.max(
            maxActivePageRequests,
            activePageRequests
          );
          await new Promise((resolve) => setTimeout(resolve, 0));
          activePageRequests -= 1;
        }

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
      "ATOM",
      "OSMO",
    ]);
    expect(getYieldTokens.mock.calls.map(([arg]) => arg.params.offset)).toEqual(
      [0, 2, 4]
    );
    expect(maxActivePageRequests).toBe(2);
  });
});
