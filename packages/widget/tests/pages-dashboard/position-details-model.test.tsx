import BigNumber from "bignumber.js";
import type { TFunction } from "i18next";
import { describe, expect, it } from "vitest";
import type { PositionBalancesByType } from "../../src/domain/types/positions";
import type { Yield } from "../../src/domain/types/yields";
import {
  type DashboardPositionPendingAction,
  getDashboardPositionDetailsModel,
} from "../../src/pages-dashboard/position-details/position-details-model";
import {
  yieldApiProviderFixture,
  yieldApiYieldFixture,
  yieldBalanceFixture,
  yieldRewardRateFixture,
} from "../fixtures";

const t = (key: string, options?: Record<string, unknown>): string => {
  const translations: Record<string, string> = {
    "dashboard.earn_details.asset": `Asset (${options?.symbol ?? ""})`,
    "dashboard.earn_details.auto_compound": "Auto-compound",
    "dashboard.earn_details.cooldown": "Redemption time",
    "dashboard.earn_details.cooldown_days": `${options?.count ?? ""} days`,
    "dashboard.earn_details.instant": "Instant",
    "dashboard.earn_details.min_stake": "Min stake",
    "dashboard.earn_details.native": "Native",
    "dashboard.earn_details.network": "Network",
    "dashboard.earn_details.no_minimum": "No minimum",
    "dashboard.earn_details.price_per_share": "Price per share",
    "dashboard.earn_details.provider": "Provider",
    "dashboard.earn_details.reward_claiming": "Reward claiming",
    "dashboard.earn_details.reward_rate_period": `${options?.rewardType ?? "APY"} (7D)`,
    "dashboard.earn_details.reward_schedule": "Reward schedule",
    "dashboard.earn_details.reward_token": "Reward token",
    "dashboard.earn_details.yield_bearing_reward_token": `${options?.symbol ?? ""} (yield-bearing)`,
    "dashboard.earn_details.risk": "Risk",
    "dashboard.earn_details.type": "Type",
    "dashboard.earn_details.vault": "Vault",
    "dashboard.position_details.action_available": "Action available",
    "dashboard.position_details.action_required": "Action required",
    "dashboard.position_details.active": "Active",
    "dashboard.position_details.balance": "Balance",
    "dashboard.position_details.rewards": "Rewards",
    "dashboard.position_details.rewards_total": "Total earned",
    "dashboard.position_details.status": "Status",
    "dashboard.position_details.withdrawal_unavailable":
      "Withdrawal unavailable",
    "details.risk.sources.credora": "Credora",
    "details.validators_inactive": "Inactive",
    "position_details.balance_type.active": "Active",
    "position_details.balance_type.claimable": "Claimable",
    "position_details.balance_type.locked": "Locked",
    "position_details.pending_action.claim_rewards": "Claim rewards",
    "position_details.personalized_apy": "Personalized APY",
    "shared.points": "Points",
    "yield_types.staking.title": "Staking",
  };

  return translations[key] ?? key;
};

const makeYield = (overrides?: Partial<Yield>): Yield =>
  ({
    ...yieldApiYieldFixture({
      rewardRate: yieldRewardRateFixture({ total: 0.04 }),
      token: {
        ...yieldApiYieldFixture().token,
        address: "0x0000000000000000000000000000000000000001",
      },
      outputToken: {
        ...yieldApiYieldFixture().token,
        address: "0x0000000000000000000000000000000000000002",
        symbol: "rETH",
      },
    }),
    provider: yieldApiProviderFixture({ name: "Rocket Pool" }),
    ...overrides,
  }) as Yield;

const makePositionBalances = (): PositionBalancesByType => {
  const token = yieldApiYieldFixture().token;

  return new Map([
    [
      "active",
      [
        {
          ...yieldBalanceFixture({
            amount: "12",
            amountUsd: "41400",
            token,
            type: "active",
          }),
          tokenPriceInUsd: new BigNumber(41400),
        },
      ],
    ],
    [
      "claimable",
      [
        {
          ...yieldBalanceFixture({
            amount: "0.25",
            amountUsd: "862",
            token,
            type: "claimable",
          }),
          tokenPriceInUsd: new BigNumber(862),
        },
      ],
    ],
    [
      "locked",
      [
        {
          ...yieldBalanceFixture({
            amount: "42",
            amountUsd: null,
            token: { ...token, isPoints: true, symbol: "PTS" },
            type: "locked",
          }),
          tokenPriceInUsd: new BigNumber(0),
        },
      ],
    ],
  ]);
};

describe("getDashboardPositionDetailsModel", () => {
  it("promotes current balance, claimable rewards, APY, and status without unsupported facts", () => {
    const model = getDashboardPositionDetailsModel({
      canUnstake: true,
      integrationData: makeYield(),
      pendingActions: [],
      personalizedRewardRate: yieldRewardRateFixture({ total: 0.025 }),
      positionBalancesByType: makePositionBalances(),
      providersDetails: [{ name: "Rocket Pool", status: "active" }],
      reducedStakedOrLiquidBalance: {
        amount: new BigNumber(12),
        amountUsd: new BigNumber(41400),
        token: yieldApiYieldFixture().token,
      },
      rewardsSummary: undefined,
      t: t as TFunction,
    });

    expect(model.metricCards.map((card) => card.id)).toEqual([
      "balance",
      "rewards",
      "apy",
      "status",
    ]);
    expect(
      model.metricCards.find((card) => card.id === "balance")
    ).toMatchObject({
      label: "Balance",
      subValue: "$41,400",
      value: "12 ETH",
    });
    expect(
      model.metricCards.find((card) => card.id === "rewards")
    ).toMatchObject({
      label: "Rewards",
      subValue: "$862",
      value: "0.25 ETH",
    });
    expect(model.metricCards.find((card) => card.id === "apy")).toMatchObject({
      label: "Personalized APY",
      value: "2.5%",
    });
    expect(model.metricCards.some((card) => card.id === "cost-basis")).toBe(
      false
    );
    expect(model.metricCards.some((card) => card.id === "net-worth")).toBe(
      false
    );
    expect(model.chartSections).toEqual([]);
  });

  it("summarizes pending actions and keeps claim CTA information separate", () => {
    const pendingActions: DashboardPositionPendingAction[] = [
      {
        amount: null,
        formattedAmount: "$862",
        pendingActionDto: {
          intent: "manage",
          passthrough: "claim",
          type: "CLAIM_REWARDS",
        },
        yieldBalance: yieldBalanceFixture({ type: "claimable" }),
      },
    ];

    const model = getDashboardPositionDetailsModel({
      canUnstake: true,
      integrationData: makeYield(),
      pendingActions,
      personalizedRewardRate: null,
      positionBalancesByType: new Map(),
      providersDetails: [{ name: "Rocket Pool", status: "active" }],
      reducedStakedOrLiquidBalance: null,
      rewardsSummary: undefined,
      t: t as TFunction,
    });

    expect(model.statusSummary).toEqual({
      label: "Action required",
      tone: "claim",
      value: "Claim rewards",
    });
    expect(
      model.metricCards.find((card) => card.id === "rewards")
    ).toMatchObject({
      subValue: "$862",
      value: "Claim rewards",
    });
  });

  it("fills an odd card count with a fallback fact and removes it from the details list", () => {
    const token = yieldApiYieldFixture().token;
    const positionBalancesByType: PositionBalancesByType = new Map([
      [
        "active",
        [
          {
            ...yieldBalanceFixture({
              amount: "12",
              amountUsd: "41400",
              token,
              type: "active",
            }),
            tokenPriceInUsd: new BigNumber(41400),
          },
        ],
      ],
    ]);

    const model = getDashboardPositionDetailsModel({
      canUnstake: true,
      integrationData: makeYield({
        mechanics: {
          ...makeYield().mechanics,
          cooldownPeriod: { seconds: 7 * 24 * 60 * 60 },
        },
      } as Partial<Yield>),
      pendingActions: [],
      personalizedRewardRate: null,
      positionBalancesByType,
      providersDetails: [{ name: "Rocket Pool", status: "active" }],
      reducedStakedOrLiquidBalance: {
        amount: new BigNumber(12),
        amountUsd: new BigNumber(41400),
        token,
      },
      rewardsSummary: undefined,
      t: t as TFunction,
    });

    expect(model.metricCards.map((card) => card.id)).toEqual([
      "balance",
      "apy",
      "status",
      "unstaking-period",
    ]);
    expect(
      model.metricCards.find((card) => card.id === "unstaking-period")
    ).toMatchObject({
      label: "Redemption time",
      value: "7 days",
    });
    expect(model.detailRows.map((row) => row.id)).not.toContain("cooldown");
  });

  it("renders balance breakdown rows, points metadata, mechanics, and copyable addresses", () => {
    const model = getDashboardPositionDetailsModel({
      canUnstake: true,
      integrationData: makeYield(),
      pendingActions: [],
      personalizedRewardRate: null,
      positionBalancesByType: makePositionBalances(),
      providersDetails: [{ name: "Rocket Pool", status: "active" }],
      reducedStakedOrLiquidBalance: null,
      rewardsSummary: {
        rewards: {
          last24H: "0",
          last30D: "0",
          last7D: "0",
          lastYear: "0",
          total: "1.5",
        },
        token: yieldApiYieldFixture().token,
      },
      t: t as TFunction,
    });

    expect(model.breakdownRows).toEqual([
      {
        id: "active-ETH-0",
        label: "Active",
        subValue: "$41,400",
        value: "12 ETH",
      },
      {
        id: "claimable-ETH-1",
        label: "Claimable",
        subValue: "$862",
        value: "0.25 ETH",
      },
      {
        id: "locked-PTS-2",
        label: "Locked",
        subValue: "Points",
        value: "42 PTS",
      },
    ]);
    expect(model.detailRows.map((row) => row.id)).toContain("network");
    expect(model.detailRows.map((row) => row.id)).toContain("reward-claiming");
    expect(model.addressRows).toEqual([
      {
        address: "0x0000000000000000000000000000000000000002",
        label: "Vault",
      },
      {
        address: "0x0000000000000000000000000000000000000001",
        label: "Asset (ETH)",
      },
    ]);
  });

  it("does not mark auto-claiming position reward tokens as yield-bearing without price per share", () => {
    const model = getDashboardPositionDetailsModel({
      canUnstake: true,
      integrationData: makeYield(),
      pendingActions: [],
      personalizedRewardRate: null,
      positionBalancesByType: makePositionBalances(),
      providersDetails: [{ name: "Rocket Pool", status: "active" }],
      reducedStakedOrLiquidBalance: null,
      rewardsSummary: undefined,
      t: t as TFunction,
    });

    expect(model.detailRows.find((row) => row.id === "reward-token")).toEqual({
      id: "reward-token",
      label: "Reward token",
      value: "rETH",
    });
  });

  it("marks position output tokens with price per share as yield-bearing", () => {
    const baseYield = yieldApiYieldFixture();
    const model = getDashboardPositionDetailsModel({
      canUnstake: true,
      integrationData: makeYield({
        mechanics: {
          ...makeYield().mechanics,
          rewardClaiming: "manual",
        },
        outputToken: {
          ...baseYield.token,
          address: "0x0000000000000000000000000000000000000002",
          symbol: "mUSDC",
        },
        state: {
          pricePerShareState: {
            price: 1.06274537,
            quoteToken: baseYield.token,
            shareToken: baseYield.token,
          },
        },
        token: {
          ...baseYield.token,
          address: "0x0000000000000000000000000000000000000001",
          symbol: "USDC",
        },
      }),
      pendingActions: [],
      personalizedRewardRate: null,
      positionBalancesByType: makePositionBalances(),
      providersDetails: [{ name: "Midas", status: "active" }],
      reducedStakedOrLiquidBalance: null,
      rewardsSummary: undefined,
      t: t as TFunction,
    });

    expect(model.detailRows.find((row) => row.id === "reward-token")).toEqual({
      id: "reward-token",
      label: "Reward token",
      value: "mUSDC (yield-bearing)",
    });
  });

  it("includes price per share in details when yield state provides it", () => {
    const model = getDashboardPositionDetailsModel({
      canUnstake: true,
      integrationData: makeYield({
        state: {
          pricePerShareState: {
            price: 1.06274537,
            quoteToken: yieldApiYieldFixture().token,
            shareToken: yieldApiYieldFixture().token,
          },
        },
      }),
      pendingActions: [],
      personalizedRewardRate: null,
      positionBalancesByType: new Map(),
      providersDetails: [{ name: "Midas", status: "active" }],
      reducedStakedOrLiquidBalance: null,
      rewardsSummary: undefined,
      t: t as TFunction,
    });

    expect(
      model.detailRows.find((row) => row.id === "price-per-share")
    ).toEqual({
      id: "price-per-share",
      label: "Price per share",
      value: "1.06274537",
    });
  });
});
