import { describe, expect, it, vi } from "vitest";
import type { TokenBalanceScanResponseDto } from "../../src/domain/types/token-balance";
import type { YieldDto } from "../../src/generated/api/yield";
import {
  fetchTokenListYieldSummaries,
  getDashboardCategoryYieldIdsForToken,
  getMaxYieldRateForToken,
} from "../../src/hooks/api/use-token-list-yields";
import type { ApiClient } from "../../src/providers/api/api-client";
import { yieldApiYieldFixture, yieldRewardRateFixture } from "../fixtures";

const yieldSummary = ({
  id,
  type,
  total = 0.01,
  enter = true,
}: {
  id: string;
  type: YieldDto["mechanics"]["type"];
  total?: number;
  enter?: boolean;
}) => {
  const base = yieldApiYieldFixture();

  return yieldApiYieldFixture({
    id,
    rewardRate: yieldRewardRateFixture({ total }),
    status: { enter, exit: true },
    mechanics: {
      ...base.mechanics,
      type,
    },
  });
};

describe("getMaxYieldRateForToken", () => {
  it("formats uppercase reward rate types from the yield API", () => {
    const yieldDto = yieldApiYieldFixture({
      id: "ethereum-eth-native-staking",
      rewardRate: yieldRewardRateFixture({
        total: 0.0349,
        rateType: "APY",
      }),
    });

    expect(
      getMaxYieldRateForToken(
        ["ethereum-eth-native-staking"],
        new Map([[yieldDto.id, yieldDto]])
      )
    ).toEqual({
      rateFormatted: "3.49%",
      rateTypeLabel: "APY",
    });
  });
});

describe("getDashboardCategoryYieldIdsForToken", () => {
  it("filters token yields to the active dashboard category and sorts by reward", () => {
    const stakingYield = yieldSummary({
      id: "ethereum-eth-native-staking",
      type: "staking",
      total: 0.12,
    });
    const vaultYield = yieldSummary({
      id: "ethereum-usdc-vault",
      type: "vault",
      total: 0.04,
    });
    const lendingYield = yieldSummary({
      id: "ethereum-usdc-lending",
      type: "lending",
      total: 0.08,
    });

    const yieldsById = new Map(
      [stakingYield, vaultYield, lendingYield].map((yieldDto) => [
        yieldDto.id,
        yieldDto,
      ])
    );

    expect(
      getDashboardCategoryYieldIdsForToken(
        [stakingYield.id, vaultYield.id, lendingYield.id],
        yieldsById,
        "defi"
      )
    ).toEqual([lendingYield.id, vaultYield.id]);
  });

  it("excludes invisible yields from category counts and selection candidates", () => {
    const visibleYield = yieldSummary({
      id: "ethereum-usdc-vault",
      type: "vault",
      total: 0.04,
    });
    const zeroRewardYield = yieldSummary({
      id: "ethereum-usdc-zero-vault",
      type: "vault",
      total: 0,
    });
    const nonEnterableYield = yieldSummary({
      id: "ethereum-usdc-disabled-lending",
      type: "lending",
      enter: false,
      total: 0.09,
    });

    const yieldsById = new Map(
      [visibleYield, zeroRewardYield, nonEnterableYield].map((yieldDto) => [
        yieldDto.id,
        yieldDto,
      ])
    );

    expect(
      getDashboardCategoryYieldIdsForToken(
        [visibleYield.id, zeroRewardYield.id, nonEnterableYield.id],
        yieldsById,
        "defi"
      )
    ).toEqual([visibleYield.id]);
  });

  it("returns no candidates when a token has no yields in the active category", () => {
    const stakingYield = yieldSummary({
      id: "ethereum-eth-native-staking",
      type: "staking",
      total: 0.12,
    });

    expect(
      getDashboardCategoryYieldIdsForToken(
        [stakingYield.id],
        new Map([[stakingYield.id, stakingYield]]),
        "defi"
      )
    ).toEqual([]);
  });
});

describe("fetchTokenListYieldSummaries", () => {
  it("loads displayed token yield metadata with bounded yield ID chunks", async () => {
    const yieldIds = Array.from(
      { length: 205 },
      (_, index) => `yield-${index}`
    );
    const tokenBalances: TokenBalanceScanResponseDto[] = [
      {
        amount: "0",
        availableYields: yieldIds.slice(0, 120),
        token: {
          decimals: 18,
          name: "Ethereum",
          network: "ethereum",
          symbol: "ETH",
        },
      },
      {
        amount: "0",
        availableYields: [...yieldIds.slice(50, 205), "yield-100"],
        token: {
          decimals: 6,
          name: "USD Coin",
          network: "ethereum",
          symbol: "USDC",
        },
      },
    ];

    const getYields = vi.fn(
      async ({ params }: { params: { yieldIds: ReadonlyArray<string> } }) => ({
        total: params.yieldIds.length,
        offset: 0,
        limit: params.yieldIds.length,
        items: params.yieldIds.map((id) => yieldApiYieldFixture({ id })),
      })
    );

    const apiClient = {
      withOptions: () => ({ yield: { YieldsControllerGetYields: getYields } }),
    } as unknown as ApiClient;

    const result = await fetchTokenListYieldSummaries({
      apiClient,
      tokenBalances,
    });

    expect(result).toHaveLength(205);
    expect(result.map((item) => item.id)).toEqual(yieldIds);
    expect(getYields).toHaveBeenCalledTimes(3);
    expect(
      getYields.mock.calls.map(([arg]) => arg.params.yieldIds.length)
    ).toEqual([100, 100, 5]);
  });
});
