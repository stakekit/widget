import BigNumber from "bignumber.js";
import { DateTime, Schema } from "effect";
import type { TFunction } from "i18next";
import { describe, expect, it } from "vitest";
import {
  ConfidentialHandle,
  EarnBalance,
  type EarnYieldWithProvider,
} from "../../../src/domain/earn/models";
import { TokenAddress } from "../../../src/domain/identity/identifiers";
import { RewardsSummary } from "../../../src/domain/portfolio/models";
import type { PositionBalancesByType } from "../../../src/domain/portfolio/positions";

import { getPositionOverviewModel } from "../../../src/features/position-details/model/position-overview";
import {
  confidentialFixture,
  confidentialYieldFixture,
  yieldApiProviderFixture,
  yieldApiYieldFixture,
  yieldBalanceFixture,
  yieldRewardRateFixture,
} from "../../fixtures";

type PositionOverviewPendingAction = Parameters<
  typeof getPositionOverviewModel
>[0]["pendingActions"][number];

const makeBalance = (overrides?: Parameters<typeof yieldBalanceFixture>[0]) =>
  Schema.decodeSync(EarnBalance)(yieldBalanceFixture(overrides));

const t = (key: string, options?: Record<string, unknown>): string => {
  const translations: Record<string, string> = {
    "dashboard.earn_details.asset": `Asset (${options?.symbol ?? ""})`,
    "dashboard.earn_details.auto_compound": "Auto-compound",
    "dashboard.earn_details.cooldown": "Redemption time",
    "dashboard.earn_details.cooldown_days": `${options?.count ?? ""} days`,
    "dashboard.earn_details.daily_batch": `Daily batch · ${options?.time ?? ""} ${options?.timezone ?? ""}`,
    "dashboard.earn_details.warmup": "Warmup",
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
    "dashboard.position_details.actions_available": `${options?.count ?? ""} actions available`,
    "dashboard.position_details.active": "Active",
    "dashboard.position_details.instant_withdrawal_in_progress":
      "Instant withdrawal in progress",
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
    "position_details.balance_type.entering": "Entering",
    "position_details.balance_type.exiting": "Exiting",
    "position_details.duration.days": `${options?.count ?? ""} days`,
    "position_details.duration.hours": `${options?.count ?? ""} hours`,
    "position_details.unstaking_duration": `${options?.duration ?? ""} remaining`,
    "position_details.next_batch_in": `Next batch in ${options?.duration ?? ""}`,
    "position_details.cancelling": "Cancelling…",
    "position_details.balance_type.locked": "Locked",
    "position_details.pending_action.cancel_pending": "Cancel pending request",
    "position_details.pending_action.cancel_pending_deposit": "Cancel deposit",
    "position_details.pending_action.cancel_pending_withdrawal":
      "Cancel withdrawal",
    "position_details.pending_action.claim_rewards": "Claim rewards",
    "position_details.pending_action.withdraw": "Withdraw",
    "position_details.personalized_apy": "Personalized APY",
    "shared.points": "Points",
    "yield_types.staking.title": "Staking",
  };

  const contextKey =
    typeof options?.context === "string" ? `${key}_${options.context}` : key;

  return translations[contextKey] ?? translations[key] ?? key;
};

const makeYield = (
  overrides?: Partial<EarnYieldWithProvider>
): EarnYieldWithProvider =>
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
  }) as EarnYieldWithProvider;

const makePositionBalances = (): PositionBalancesByType => {
  const token = yieldApiYieldFixture().token;

  return new Map([
    [
      "active",
      [
        {
          ...makeBalance({
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
          ...makeBalance({
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
          ...makeBalance({
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

describe("getPositionOverviewModel", () => {
  it("promotes current balance, claimable rewards, APY, and status without unsupported facts", () => {
    const model = getPositionOverviewModel({
      canUnstake: true,
      locale: "en",
      now: null,
      integrationData: makeYield(),
      pendingActions: [],
      personalizedRewardRate: yieldRewardRateFixture({ total: 0.025 }),
      positionBalancesByType: makePositionBalances(),
      providersDetails: [{ name: "Rocket Pool", status: "active" }],
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
      subValue: "$41.4K",
      value: "12 ETH",
    });
    expect(
      model.metricCards.find((card) => card.id === "rewards")
    ).toMatchObject({
      label: "Rewards",
      subValue: "$862.00",
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

  it("shows every active token sum and totals only USD across tokens", () => {
    const token = yieldApiYieldFixture().token;
    const cake = { ...token, symbol: "CAKE" };
    const usdt = {
      ...token,
      address: "0x0000000000000000000000000000000000000003",
      symbol: "USDT",
    };
    const active = (overrides: Parameters<typeof yieldBalanceFixture>[0]) => ({
      ...makeBalance({ type: "active", ...overrides }),
      tokenPriceInUsd: new BigNumber(0),
    });

    const model = getPositionOverviewModel({
      canUnstake: false,
      locale: "en",
      now: null,
      integrationData: makeYield(),
      pendingActions: [],
      personalizedRewardRate: null,
      positionBalancesByType: new Map([
        [
          "active",
          [
            active({ amount: "2", amountUsd: "4", token: cake }),
            active({ amount: "1", amountUsd: "2", token: cake }),
            active({ amount: "10", amountUsd: "10", token: usdt }),
          ],
        ],
      ]),
      providersDetails: [],
      rewardsSummary: undefined,
      t: t as TFunction,
    });

    expect(
      model.metricCards.find((card) => card.id === "balance")
    ).toMatchObject({
      subValue: "$16.00",
      value: ["3 CAKE", "10 USDT"],
    });
  });

  it("groups breakdown rows by status, token identity, and date", () => {
    const token = yieldApiYieldFixture().token;
    const usdcA = {
      ...token,
      address: "0x00000000000000000000000000000000000000a1",
      symbol: "USDC",
    };
    const usdcB = {
      ...usdcA,
      address: "0x00000000000000000000000000000000000000b2",
    };
    const balance = (overrides: Parameters<typeof yieldBalanceFixture>[0]) => ({
      ...makeBalance(overrides),
      tokenPriceInUsd: new BigNumber(0),
    });

    const model = getPositionOverviewModel({
      canUnstake: true,
      locale: "en",
      now: null,
      integrationData: makeYield(),
      pendingActions: [],
      personalizedRewardRate: null,
      positionBalancesByType: new Map([
        [
          "active",
          [
            balance({ amount: "2", amountUsd: "2", token: usdcA }),
            balance({ amount: "1", amountUsd: "1", token: usdcB }),
            balance({ amount: "3", amountUsd: "3", token: usdcA }),
          ],
        ],
        [
          "exiting",
          [
            balance({
              amount: "4",
              amountUsd: "4",
              date: "2026-11-01T00:00:00.000Z",
              token: usdcA,
              type: "exiting",
            }),
            balance({
              amount: "6",
              amountUsd: "6",
              date: "2026-12-01T00:00:00.000Z",
              token: usdcA,
              type: "exiting",
            }),
            balance({
              amount: "1",
              amountUsd: "1",
              date: "2026-11-01T00:00:00.000Z",
              token: usdcA,
              type: "exiting",
            }),
          ],
        ],
      ]),
      providersDetails: [],
      rewardsSummary: undefined,
      t: t as TFunction,
    });

    expect(
      model.breakdownRows.map(({ label, value }) => ({ label, value }))
    ).toEqual([
      { label: "Active", value: "5 USDC" },
      { label: "Active", value: "1 USDC" },
      { label: "Exiting", value: "5 USDC" },
      { label: "Exiting", value: "6 USDC" },
    ]);
    expect(model.breakdownRows.map((row) => row.subValue)).toEqual([
      "$5.00",
      "$1.00",
      "$5.00",
      "$6.00",
    ]);
  });

  it("tells when a batched vault settles its undated pending balances", () => {
    const token = yieldApiYieldFixture().token;
    const balance = (overrides: Parameters<typeof yieldBalanceFixture>[0]) => ({
      ...makeBalance(overrides),
      tokenPriceInUsd: new BigNumber(1),
    });
    const dailyPath = (cutoffTime: string) => ({
      cadence: "daily_cutoff",
      cutoffTime,
      kind: "standard",
      status: "open",
    });

    const model = getPositionOverviewModel({
      canUnstake: true,
      locale: "en",
      integrationData: makeYield({
        investmentSchedule: {
          redemption: { paths: [dailyPath("11:00")] },
          subscription: { paths: [dailyPath("15:00")] },
          timezone: "UTC",
        },
      }),
      now: DateTime.makeUnsafe("2026-10-19T12:00:00Z"),
      pendingActions: [],
      personalizedRewardRate: null,
      positionBalancesByType: new Map([
        ["active", [balance({ amount: "1", amountUsd: "1", token })]],
        [
          "entering",
          [balance({ amount: "2", amountUsd: "2", token, type: "entering" })],
        ],
        [
          "exiting",
          [
            balance({
              amount: "3",
              amountUsd: "3",
              date: "2026-10-25T00:00:00.000Z",
              token,
              type: "exiting",
            }),
          ],
        ],
      ]),
      providersDetails: [],
      rewardsSummary: undefined,
      t: t as TFunction,
    });

    expect(
      Object.fromEntries(
        model.breakdownRows.map((row) => [row.label, row.subValue])
      )
    ).toEqual({
      Active: "$1.00",
      Entering: "$2.00 · Next batch in 3 hours",
      // The API's own settlement date wins over the batch estimate.
      Exiting: "$3.00 · 5 days remaining",
    });
  });

  it("gives a confidential vault's undated pending balance no next-batch estimate", () => {
    const model = getPositionOverviewModel({
      canUnstake: false,
      locale: "en",
      integrationData: {
        ...confidentialYieldFixture(),
        investmentSchedule: {
          redemption: { paths: [] },
          subscription: {
            paths: [
              {
                cadence: "daily_cutoff",
                currentWindow: {
                  closesAt: "2026-10-19T15:00:00.000Z",
                  opensAt: "2026-10-18T15:00:00.000Z",
                },
                cutoffTime: "15:00",
                kind: "standard",
                status: "open",
              },
            ],
          },
          timezone: "UTC",
        },
        provider: yieldApiProviderFixture({ name: "Zama" }),
      } as EarnYieldWithProvider,
      now: DateTime.makeUnsafe("2026-10-19T12:00:00Z"),
      pendingActions: [],
      personalizedRewardRate: null,
      positionBalancesByType: new Map([
        [
          "entering",
          [
            {
              ...makeBalance({ amount: "2", amountUsd: "2", type: "entering" }),
              tokenPriceInUsd: new BigNumber(1),
            },
          ],
        ],
      ]),
      providersDetails: [],
      rewardsSummary: undefined,
      t: t as TFunction,
    });

    expect(model.breakdownRows.map(({ subValue }) => subValue)).toEqual([
      "$2.00",
    ]);
  });

  it("shows a pending balance whose cancel is in flight as cancelling, hidden or revealed", () => {
    const cancelling = Schema.decodeSync(ConfidentialHandle)(
      `0x${"a".repeat(64)}`
    );
    const other = Schema.decodeSync(ConfidentialHandle)(`0x${"b".repeat(64)}`);
    const balance = (overrides: Parameters<typeof yieldBalanceFixture>[0]) => ({
      ...makeBalance({
        amount: "0",
        amountUsd: "0",
        date: "2026-10-20T15:00:00.000Z",
        ...overrides,
      }),
      tokenPriceInUsd: new BigNumber(1),
    });
    const model = getPositionOverviewModel({
      cancellingHandles: new Set([cancelling]),
      canUnstake: true,
      locale: "en",
      integrationData: {
        ...confidentialYieldFixture(),
        provider: yieldApiProviderFixture({ name: "Zama" }),
      } as EarnYieldWithProvider,
      now: DateTime.makeUnsafe("2026-10-19T15:00:00Z"),
      pendingActions: [],
      personalizedRewardRate: null,
      positionBalancesByType: new Map([
        [
          "entering",
          [
            balance({
              isEncrypted: true,
              shareAmountRaw: cancelling,
              type: "entering",
            }),
          ],
        ],
        [
          "exiting",
          [
            // A revealed balance keeps the handle it was decrypted from.
            {
              ...balance({ amount: "1", amountUsd: "1", type: "exiting" }),
              shares: {
                _tag: "Revealed",
                amount: new BigNumber("1"),
                amountRaw: 1_000_000n,
                handle: cancelling,
              },
            },
            balance({
              amount: "2",
              amountUsd: "2",
              date: "2026-10-21T15:00:00.000Z",
              isEncrypted: true,
              shareAmountRaw: other,
              type: "exiting",
            }),
          ],
        ],
      ]),
      providersDetails: [],
      rewardsSummary: undefined,
      t: t as TFunction,
    });

    expect(model.breakdownRows.map(({ subValue }) => subValue)).toEqual([
      "Cancelling…",
      "$1.00 · Cancelling…",
      "$2.00 · 2 days remaining",
    ]);
    expect(model.statusSummary).toEqual({
      label: "Status",
      tone: "default",
      value: "Cancelling…",
    });
  });

  it("shows no static redemption or warmup for a confidential vault", () => {
    const model = getPositionOverviewModel({
      canUnstake: true,
      locale: "en",
      integrationData: {
        ...confidentialYieldFixture(),
        provider: yieldApiProviderFixture({ name: "Zama" }),
      } as EarnYieldWithProvider,
      now: DateTime.makeUnsafe("2026-10-19T12:00:00Z"),
      pendingActions: [],
      personalizedRewardRate: null,
      positionBalancesByType: makePositionBalances(),
      providersDetails: [],
      rewardsSummary: undefined,
      t: t as TFunction,
    });

    expect(
      model.detailRows.filter((row) => ["cooldown", "warmup"].includes(row.id))
    ).toEqual([]);
    expect(
      model.metricCards.some((card) => card.id === "unstaking-period")
    ).toBe(false);
  });

  it("shows a confidential vault's pending withdrawal in the vault shares it redeems", () => {
    const { cShare, usdc } = confidentialFixture;
    const model = getPositionOverviewModel({
      canUnstake: true,
      locale: "en",
      integrationData: {
        ...confidentialYieldFixture(),
        provider: yieldApiProviderFixture({ name: "Zama" }),
      } as EarnYieldWithProvider,
      now: null,
      pendingActions: [],
      personalizedRewardRate: null,
      positionBalancesByType: new Map([
        [
          "exiting",
          [
            {
              ...makeBalance({
                amount: "0.1",
                amountUsd: "0.1",
                shareAmount: "0.097168",
                shareToken: cShare,
                token: usdc,
                type: "exiting",
              }),
              tokenPriceInUsd: new BigNumber(1),
            },
          ],
        ],
      ]),
      providersDetails: [],
      rewardsSummary: undefined,
      t: t as TFunction,
    });

    expect(model.breakdownRows.map(({ value }) => value)).toEqual([
      `0.09716 ${cShare.symbol}`,
    ]);
  });

  it("describes redemption and warmup of a batched vault by its batches", () => {
    const dailyPath = (cutoffTime: string) => ({
      cadence: "daily_cutoff",
      cutoffTime,
      kind: "standard",
      status: "open",
    });
    const integrationData = makeYield();

    const model = getPositionOverviewModel({
      canUnstake: true,
      locale: "en",
      integrationData: {
        ...integrationData,
        investmentSchedule: {
          redemption: { paths: [dailyPath("11:00")] },
          subscription: { paths: [dailyPath("15:00")] },
          timezone: "UTC",
        },
        mechanics: {
          ...integrationData.mechanics,
          cooldownPeriod: { seconds: 86_400 },
          warmupPeriod: { seconds: 86_400 },
        },
      },
      now: DateTime.makeUnsafe("2026-10-19T12:00:00Z"),
      pendingActions: [],
      personalizedRewardRate: null,
      positionBalancesByType: makePositionBalances(),
      providersDetails: [],
      rewardsSummary: undefined,
      t: t as TFunction,
    });
    const facts = new Map(
      [...model.metricCards, ...model.detailRows].map((fact) => [
        fact.id,
        fact.value,
      ])
    );

    // The redemption fact is a metric card or a detail row, by layout.
    expect(facts.get("unstaking-period") ?? facts.get("cooldown")).toBeOneOf([
      "Next batch in 23 hours",
      "Daily batch · 11:00 UTC",
    ]);
    expect(facts.get("warmup")).toBe("Daily batch · 15:00 UTC");
    expect([...facts.values()]).not.toContain("1 days");
  });

  it("sums repeated claimable tokens and shows every reward token", () => {
    const token = yieldApiYieldFixture().token;
    const kmno = {
      ...token,
      address: "0x0000000000000000000000000000000000000004",
      symbol: "KMNO",
    };
    const usdcA = {
      ...token,
      address: "0x0000000000000000000000000000000000000005",
      symbol: "USDC",
    };
    const usdcB = {
      ...token,
      address: "0x0000000000000000000000000000000000000006",
      symbol: "USDC",
    };
    const claimable = (
      overrides: Parameters<typeof yieldBalanceFixture>[0]
    ) => ({
      ...makeBalance({ type: "claimable", ...overrides }),
      tokenPriceInUsd: new BigNumber(0),
    });

    const model = getPositionOverviewModel({
      canUnstake: true,
      locale: "en",
      now: null,
      integrationData: makeYield(),
      pendingActions: [],
      personalizedRewardRate: null,
      positionBalancesByType: new Map([
        [
          "claimable",
          [
            claimable({ amount: "1.5", amountUsd: "3", token: kmno }),
            claimable({ amount: "2", amountUsd: "2", token: usdcA }),
            claimable({ amount: "2.5", amountUsd: "5", token: kmno }),
            claimable({ amount: "7", amountUsd: "7", token: usdcB }),
            claimable({
              amount: "99",
              amountUsd: "0",
              token: { ...token, isPoints: true, symbol: "PTS" },
            }),
          ],
        ],
      ]),
      providersDetails: [],
      rewardsSummary: undefined,
      t: t as TFunction,
    });

    expect(
      model.metricCards.find((card) => card.id === "rewards")
    ).toMatchObject({
      subValue: "$17.00",
      value: ["4 KMNO", "2 USDC", "7 USDC"],
    });
  });

  it("keeps claimable balances out of status when no action is pending", () => {
    const activeToken = yieldApiYieldFixture().token;
    const activeBalance = makeBalance({
      amount: "0.000205427561919412",
      amountUsd: "0.332550",
      token: activeToken,
      type: "active",
    });
    const pointsBalance = makeBalance({
      amount: "1214.8591",
      amountUsd: "0",
      token: {
        ...activeToken,
        isPoints: true,
        symbol: "KelpDAO Miles",
      },
      type: "claimable",
    });
    const tokenClaimableBalance = makeBalance({
      amount: "0.25",
      amountUsd: "862",
      token: activeToken,
      type: "claimable",
    });

    const model = getPositionOverviewModel({
      canUnstake: false,
      locale: "en",
      now: null,
      integrationData: makeYield({
        status: { enter: false, exit: false },
      }),
      pendingActions: [],
      personalizedRewardRate: null,
      positionBalancesByType: new Map([
        [
          "active",
          [{ ...activeBalance, tokenPriceInUsd: new BigNumber("0.332550") }],
        ],
        [
          "claimable",
          [
            {
              ...tokenClaimableBalance,
              tokenPriceInUsd: new BigNumber(862),
            },
            { ...pointsBalance, tokenPriceInUsd: new BigNumber(0) },
          ],
        ],
      ]),
      providersDetails: [{ name: "Rocket Pool", status: "active" }],
      rewardsSummary: undefined,
      t: t as TFunction,
    });

    expect(model.statusSummary).toEqual({
      label: "Status",
      tone: "default",
      value: "Withdrawal unavailable",
    });
  });

  it("summarizes pending actions and keeps claim CTA information separate", () => {
    const pendingActions: PositionOverviewPendingAction[] = [
      {
        amount: null,
        amountUsd: new BigNumber(862),
        pendingAction: {
          intent: "manage",
          passthrough: "claim",
          type: "CLAIM_REWARDS",
        },
        yieldBalance: makeBalance({ type: "claimable" }),
      },
    ];

    const model = getPositionOverviewModel({
      canUnstake: true,
      locale: "en",
      now: null,
      integrationData: makeYield(),
      pendingActions,
      personalizedRewardRate: null,
      positionBalancesByType: new Map(),
      providersDetails: [{ name: "Rocket Pool", status: "active" }],
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
      subValue: "$862.00",
      value: "Claim rewards",
    });
  });

  it.each([
    ["entering", "Cancel deposit"],
    ["exiting", "Cancel withdrawal"],
    ["withdrawable", "Cancel pending request"],
  ] as const)(
    "names the optional cancel action by the %s request it cancels",
    (balanceType, value) => {
      const model = getPositionOverviewModel({
        canUnstake: true,
        locale: "en",
        integrationData: makeYield(),
        pendingActions: [
          {
            amount: null,
            amountUsd: null,
            pendingAction: {
              intent: "manage",
              passthrough: "cancel",
              type: "CANCEL_PENDING",
            },
            yieldBalance: makeBalance({ type: balanceType }),
          },
        ],
        personalizedRewardRate: null,
        positionBalancesByType: new Map(),
        providersDetails: [{ name: "Rocket Pool", status: "active" }],
        rewardsSummary: undefined,
        t: t as TFunction,
      });

      expect(model.statusSummary).toEqual({
        label: "Action available",
        tone: "default",
        value,
      });
    }
  );

  it("lets a required action outrank an earlier optional cancellation", () => {
    const model = getPositionOverviewModel({
      canUnstake: true,
      locale: "en",
      integrationData: makeYield(),
      pendingActions: [
        {
          amount: null,
          amountUsd: null,
          pendingAction: {
            intent: "manage",
            passthrough: "cancel",
            type: "CANCEL_PENDING",
          },
          yieldBalance: makeBalance({ type: "entering" }),
        },
        {
          amount: null,
          amountUsd: null,
          pendingAction: {
            intent: "manage",
            passthrough: "withdraw",
            type: "WITHDRAW",
          },
          yieldBalance: makeBalance({ type: "withdrawable" }),
        },
      ],
      personalizedRewardRate: null,
      positionBalancesByType: new Map(),
      providersDetails: [{ name: "Rocket Pool", status: "active" }],
      rewardsSummary: undefined,
      t: t as TFunction,
    });

    expect(model.statusSummary).toEqual({
      label: "Action required",
      tone: "action",
      value: "Withdraw",
    });
  });

  it("names a confidential vault's unfinished instant withdrawal as in progress, not as required", () => {
    const model = getPositionOverviewModel({
      canUnstake: true,
      locale: "en",
      integrationData: {
        ...confidentialYieldFixture(),
        provider: yieldApiProviderFixture({ name: "Zama" }),
      } as EarnYieldWithProvider,
      pendingActions: [
        {
          amount: null,
          amountUsd: null,
          pendingAction: {
            intent: "manage",
            passthrough: "unwrap",
            type: "WITHDRAW",
          },
          yieldBalance: makeBalance({
            isEncrypted: true,
            type: "withdrawable",
          }),
        },
      ],
      personalizedRewardRate: null,
      positionBalancesByType: new Map(),
      providersDetails: [],
      rewardsSummary: undefined,
      t: t as TFunction,
    });

    expect(model.statusSummary).toEqual({
      label: "Status",
      tone: "default",
      value: "Instant withdrawal in progress",
    });
  });

  it("summarises several optional actions by their count rather than picking one", () => {
    const cancel = (type: "entering" | "exiting") => ({
      amount: null,
      amountUsd: null,
      pendingAction: {
        intent: "manage" as const,
        passthrough: `cancel-${type}`,
        type: "CANCEL_PENDING" as const,
      },
      yieldBalance: makeBalance({ type }),
    });
    const model = getPositionOverviewModel({
      canUnstake: true,
      locale: "en",
      integrationData: makeYield(),
      pendingActions: [cancel("entering"), cancel("exiting")],
      personalizedRewardRate: null,
      positionBalancesByType: new Map(),
      providersDetails: [{ name: "Rocket Pool", status: "active" }],
      rewardsSummary: undefined,
      t: t as TFunction,
    });

    expect(model.statusSummary).toEqual({
      label: "Status",
      tone: "default",
      value: "2 actions available",
    });
  });

  it("times redemption by the user's own pending withdrawal, not the vault's next batch", () => {
    const token = yieldApiYieldFixture().token;
    const balance = (overrides: Parameters<typeof yieldBalanceFixture>[0]) => ({
      ...makeBalance({ amountUsd: "1", token, ...overrides }),
      tokenPriceInUsd: new BigNumber(1),
    });
    const model = getPositionOverviewModel({
      canUnstake: true,
      locale: "en",
      integrationData: makeYield({
        investmentSchedule: {
          redemption: {
            paths: [
              {
                cadence: "daily_cutoff",
                cutoffTime: "11:00",
                kind: "standard",
                status: "open",
              },
            ],
          },
          subscription: { paths: [] },
          timezone: "UTC",
        },
      }),
      now: DateTime.makeUnsafe("2026-10-19T12:00:00Z"),
      pendingActions: [],
      personalizedRewardRate: null,
      positionBalancesByType: new Map([
        ["active", [balance({ amount: "1" })]],
        [
          "exiting",
          [
            balance({
              amount: "1",
              date: "2026-10-19T15:00:00.000Z",
              type: "exiting",
            }),
          ],
        ],
      ]),
      providersDetails: [],
      rewardsSummary: undefined,
      t: t as TFunction,
    });

    expect(
      model.metricCards.find((card) => card.id === "unstaking-period")
    ).toMatchObject({ label: "Redemption time", value: "3 hours remaining" });
  });

  it("keeps a stake account merge optional in the status summary", () => {
    const model = getPositionOverviewModel({
      canUnstake: true,
      locale: "en",
      integrationData: makeYield(),
      pendingActions: [
        {
          amount: null,
          amountUsd: null,
          pendingAction: {
            intent: "manage",
            passthrough: "merge",
            type: "MERGE",
          },
          yieldBalance: makeBalance({ type: "active" }),
        },
      ],
      personalizedRewardRate: null,
      positionBalancesByType: new Map(),
      providersDetails: [{ name: "Rocket Pool", status: "active" }],
      rewardsSummary: undefined,
      t: t as TFunction,
    });

    expect(model.statusSummary).toMatchObject({
      label: "Action available",
      tone: "default",
    });
  });

  it("fills an odd card count with a fallback fact and removes it from the details list", () => {
    const token = yieldApiYieldFixture().token;
    const positionBalancesByType: PositionBalancesByType = new Map([
      [
        "active",
        [
          {
            ...makeBalance({
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

    const model = getPositionOverviewModel({
      canUnstake: true,
      locale: "en",
      now: null,
      integrationData: makeYield({
        mechanics: {
          ...makeYield().mechanics,
          cooldownPeriod: { seconds: 7 * 24 * 60 * 60 },
        },
      } as Partial<EarnYieldWithProvider>),
      pendingActions: [],
      personalizedRewardRate: null,
      positionBalancesByType,
      providersDetails: [{ name: "Rocket Pool", status: "active" }],
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
    const model = getPositionOverviewModel({
      canUnstake: true,
      locale: "en",
      now: null,
      integrationData: makeYield(),
      pendingActions: [],
      personalizedRewardRate: null,
      positionBalancesByType: makePositionBalances(),
      providersDetails: [{ name: "Rocket Pool", status: "active" }],
      rewardsSummary: Schema.decodeSync(RewardsSummary)({
        rewards: { total: "1.5" },
        token: yieldApiYieldFixture().token,
      }),
      t: t as TFunction,
    });

    expect(model.breakdownRows).toEqual([
      {
        id: "active-ETH-0",
        label: "Active",
        subValue: "$41.4K",
        value: "12 ETH",
      },
      {
        id: "claimable-ETH-1",
        label: "Claimable",
        subValue: "$862.00",
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
    const model = getPositionOverviewModel({
      canUnstake: true,
      locale: "en",
      now: null,
      integrationData: makeYield(),
      pendingActions: [],
      personalizedRewardRate: null,
      positionBalancesByType: makePositionBalances(),
      providersDetails: [{ name: "Rocket Pool", status: "active" }],
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
    const model = getPositionOverviewModel({
      canUnstake: true,
      locale: "en",
      now: null,
      integrationData: makeYield({
        mechanics: {
          ...makeYield().mechanics,
          rewardClaiming: "manual",
        },
        outputToken: {
          ...baseYield.token,
          address: Schema.decodeSync(TokenAddress)(
            "0x0000000000000000000000000000000000000002"
          ),
          symbol: "mUSDC",
        },
        state: {
          pricePerShareState: {
            price: new BigNumber("1.06274537"),
            shareToken: baseYield.token,
          },
        },
        token: {
          ...baseYield.token,
          address: Schema.decodeSync(TokenAddress)(
            "0x0000000000000000000000000000000000000001"
          ),
          symbol: "USDC",
        },
      }),
      pendingActions: [],
      personalizedRewardRate: null,
      positionBalancesByType: makePositionBalances(),
      providersDetails: [{ name: "Midas", status: "active" }],
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
    const model = getPositionOverviewModel({
      canUnstake: true,
      locale: "en",
      now: null,
      integrationData: makeYield({
        state: {
          pricePerShareState: {
            price: new BigNumber("1.06274537"),
            shareToken: yieldApiYieldFixture().token,
          },
        },
      }),
      pendingActions: [],
      personalizedRewardRate: null,
      positionBalancesByType: new Map(),
      providersDetails: [{ name: "Midas", status: "active" }],
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
