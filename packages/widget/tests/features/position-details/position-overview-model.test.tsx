import BigNumber from "bignumber.js";
import { Cause, DateTime, Option, Schema } from "effect";
import type { TFunction } from "i18next";
import { describe, expect, it } from "vitest";
import {
  ConfidentialHandle,
  EarnBalance,
} from "../../../src/domain/earn/balance";
import type { EarnYieldWithProvider } from "../../../src/domain/earn/yield-schema";
import { YieldRewardsSummary } from "../../../src/domain/portfolio/models";
import type { PositionBalancesByType } from "../../../src/domain/portfolio/positions";

import {
  getPositionOverviewModel,
  getPositionProviderName,
} from "../../../src/features/position-details/model/position-overview";
import {
  confidentialFixture,
  confidentialYieldFixture,
  yieldApiProviderFixture,
  yieldApiYieldFixture,
  yieldBalanceFixture,
  yieldRewardRateFixture,
} from "../../fixtures";

const makeBalance = (overrides?: Parameters<typeof yieldBalanceFixture>[0]) =>
  Schema.decodeSync(EarnBalance)(yieldBalanceFixture(overrides));

/** A tracked summary as the page presents it: the latest attempt succeeded. */
const makeRewardsSummary = ({
  last7D = "0",
  token = { decimals: 18, network: "ethereum", symbol: "ETH" },
  total = "0",
}: {
  last7D?: string;
  token?: { decimals: number; network: string; symbol: string };
  total?: string;
}) => {
  const window = (amount: string) => ({ amount, amountRaw: "0" });
  return {
    _tag: "Ready",
    refreshFailure: Option.none(),
    refreshing: false,
    value: Option.some(
      Schema.decodeUnknownSync(YieldRewardsSummary)({
        token,
        last24H: window("0"),
        last7D: window(last7D),
        last30D: window(last7D),
        lastYear: window(total),
        total: window(total),
      })
    ),
  } as const;
};

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
    "dashboard.earn_details.no_minimum": "No minimum",
    "dashboard.earn_details.price_per_share": "Price per share",
    "dashboard.earn_details.reward_claiming": "Reward claiming",
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
    "dashboard.position_details.shares": "Shares",
    "shared.confidential.hidden": "Hidden",
    "dashboard.position_details.rewards": "Rewards",
    "dashboard.position_details.status": "Status",
    "dashboard.position_details.withdrawal_unavailable":
      "Withdrawal unavailable",
    "details.risk.sources.credora": "Credora",
    "details.validators_inactive": "Inactive",
    "details.validators_jailed": "Jailed",
    "positions.action_required": "Action required",
    "positions.rewards_to_claim": "Claim rewards",
    "positions.ready_to_withdraw": "Ready to withdraw",
    "positions.in_progress": "In progress",
    "position_details.pending_action.merge": "Merge stake accounts",
    "position_details.balance_type.active": "Active",
    "position_details.balance_type.active_yearn_or_deposit": "Deposited",
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
    "position_details.rate_badge": `${options?.rate ?? ""} ${options?.label ?? ""}`,
    "position_details.earned_last_7d": "Earned · last 7 days",
    "position_details.earned_all_time": "Earned · all time",
    "position_details.projected_yearly": "Projected · per year",
    "position_details.projected_amount": `≈ ${options?.amount ?? ""}`,
    "position_details.earned_info_label": "About earned",
    "position_details.earned_info": "Tracked since first indexed",
    "details.validators_website": "Website",
    "shared.fees": "Fees",
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

type OverviewInput = Parameters<typeof getPositionOverviewModel>[0];

describe("getPositionOverviewModel", () => {
  it("sums the position up: its USD value, token amount, rate and projected earnings", () => {
    const model = getPositionOverviewModel({
      locale: "en",
      now: null,
      integrationData: makeYield(),
      personalizedRewardRate: yieldRewardRateFixture({ total: 0.025 }),
      positionBalancesByType: makePositionBalances(),
      t: t as TFunction,
      validators: null,
    });

    // The hero is the position total Manage shows, in its primary token.
    expect(model.summary).toEqual({
      value: "$42,262.00",
      subvalue: "12.25 ETH",
      rate: "2.50% Personalized APY",
      rows: [
        {
          id: "projected",
          label: "Projected · per year",
          tone: "muted",
          value: "≈ $1,056.55",
        },
      ],
    });
    // The summary's rate is left out of the yield's facts.
    expect(model.omittedYieldFacts).toEqual(["reward-rate"]);
  });

  it("projects nothing under a cent a year, as for a dust position", () => {
    const token = yieldApiYieldFixture().token;
    const model = getPositionOverviewModel({
      locale: "en",
      now: null,
      integrationData: makeYield(),
      personalizedRewardRate: null,
      positionBalancesByType: new Map([
        [
          "active",
          [
            {
              ...makeBalance({
                amount: "0.0000013",
                amountUsd: "0.0044",
                token,
                type: "active",
              }),
              tokenPriceInUsd: new BigNumber("0.0044"),
            },
          ],
        ],
      ]),
      t: t as TFunction,
      validators: null,
    });

    expect(model.summary.rate).toBe("4.00% APY");
    expect(model.summary.rows).toEqual([]);
  });

  it("reads a validator position's rate as its validators' average", () => {
    const model = getPositionOverviewModel({
      locale: "en",
      now: null,
      integrationData: makeYield(),
      personalizedRewardRate: null,
      positionBalancesByType: makePositionBalances(),
      t: t as TFunction,
      validators: [
        { rewardRate: new BigNumber("0.03") },
        { rewardRate: new BigNumber("0.05") },
      ],
    });

    expect(model.summary.rate).toBe("4.00% APY");
    // The yield's facts list the provider's website beside the validators'.
    expect(model.omittedYieldFacts).toEqual(["reward-rate"]);
  });

  it("averages only the validators with rates, in their rate type", () => {
    const model = getPositionOverviewModel({
      locale: "en",
      now: null,
      integrationData: makeYield(),
      personalizedRewardRate: null,
      positionBalancesByType: makePositionBalances(),
      t: t as TFunction,
      validators: [
        { rewardRate: new BigNumber("0.03"), rewardType: "apr" },
        { rewardRate: null },
      ],
    });

    expect(model.summary.rate).toBe("3.00% APR");
  });

  it("estimates no earnings and leaves the rate to the yield's facts without one", () => {
    const model = getPositionOverviewModel({
      locale: "en",
      now: null,
      integrationData: makeYield({
        rewardRate: yieldRewardRateFixture({ total: 0 }),
      }),
      personalizedRewardRate: null,
      positionBalancesByType: makePositionBalances(),
      t: t as TFunction,
      validators: null,
    });

    expect(model.summary).not.toHaveProperty("rate");
    expect(model.summary.rows).toEqual([]);
    expect(model.omittedYieldFacts).toEqual([]);
  });

  it("reads a fully hidden position as hidden, not as zero", () => {
    const { cShare, cUsdc } = confidentialFixture;
    const model = getPositionOverviewModel({
      locale: "en",
      now: null,
      integrationData: makeYield(),
      personalizedRewardRate: null,
      positionBalancesByType: new Map([
        [
          "active",
          [
            {
              ...makeBalance({
                amount: "0",
                amountRaw: "0",
                isEncrypted: true,
                shareAmount: "0",
                shareAmountRaw: `0x${"ab".repeat(32)}`,
                shareToken: cShare,
                token: cUsdc,
                type: "active",
              }),
              tokenPriceInUsd: new BigNumber(1),
            },
          ],
        ],
      ]),
      t: t as TFunction,
      validators: null,
    });

    expect(model.summary.value).toBe("Hidden");
    expect(model.summary.subvalue).toBeUndefined();
  });

  it("counts every balance in the primary Value Token at its USD price", () => {
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
      locale: "en",
      now: null,
      integrationData: makeYield(),
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
      t: t as TFunction,
      validators: null,
    });

    expect(model.summary).toMatchObject({
      subvalue: "8 CAKE",
      value: "$16.00",
    });
  });

  it("lists an unpriced second token apart instead of adding its raw amount", () => {
    const token = yieldApiYieldFixture().token;
    const usdc = { ...token, symbol: "USDC" };
    const foo = {
      ...token,
      address: "0x00000000000000000000000000000000000000f1",
      symbol: "FOO",
    };
    const model = getPositionOverviewModel({
      locale: "en",
      now: null,
      integrationData: makeYield(),
      personalizedRewardRate: null,
      positionBalancesByType: new Map([
        [
          "active",
          [
            {
              ...makeBalance({
                amount: "5",
                amountUsd: "5",
                token: usdc,
                type: "active",
              }),
              tokenPriceInUsd: new BigNumber(1),
            },
          ],
        ],
        [
          "claimable",
          [
            {
              ...makeBalance({
                amount: "1000",
                amountUsd: null,
                token: foo,
                type: "claimable",
              }),
              tokenPriceInUsd: new BigNumber(0),
            },
          ],
        ],
      ]),
      t: t as TFunction,
      validators: null,
    });

    expect(model.summary).toMatchObject({
      subvalue: "5 USDC · 1,000 FOO",
      value: "$5.00",
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
      locale: "en",
      now: null,
      integrationData: makeYield(),
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
      t: t as TFunction,
      validators: null,
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
      locale: "en",
      integrationData: makeYield({
        investmentSchedule: {
          redemption: { paths: [dailyPath("11:00")] },
          subscription: { paths: [dailyPath("15:00")] },
          timezone: "UTC",
        },
      }),
      now: DateTime.makeUnsafe("2026-10-19T12:00:00Z"),
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
      t: t as TFunction,
      validators: null,
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
      t: t as TFunction,
      validators: null,
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
    const input: OverviewInput = {
      cancellingHandles: new Set([cancelling]),
      locale: "en",
      integrationData: {
        ...confidentialYieldFixture(),
        provider: yieldApiProviderFixture({ name: "Zama" }),
      } as EarnYieldWithProvider,
      now: DateTime.makeUnsafe("2026-10-19T15:00:00Z"),
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
      t: t as TFunction,
      validators: null,
    };
    const model = getPositionOverviewModel(input);

    expect(model.breakdownRows.map(({ subValue }) => subValue)).toEqual([
      "Cancelling…",
      "$1.00 · Cancelling…",
      "$2.00 · 2 days remaining",
    ]);
  });

  it("times the user's own pending withdrawal on its row, not by the vault's next batch", () => {
    const token = yieldApiYieldFixture().token;
    const balance = (overrides: Parameters<typeof yieldBalanceFixture>[0]) => ({
      ...makeBalance({ amountUsd: "1", token, ...overrides }),
      tokenPriceInUsd: new BigNumber(1),
    });
    const model = getPositionOverviewModel({
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
      personalizedRewardRate: null,
      positionBalancesByType: new Map([
        ["active", [balance({ amount: "1" })]],
        // Rewards make three cards, so the redemption time fills the fourth.
        ["claimable", [balance({ amount: "0.1", type: "claimable" })]],
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
      t: t as TFunction,
      validators: null,
    });

    expect(
      model.breakdownRows.find((row) => row.id.startsWith("exiting"))?.subValue
    ).toContain("3 hours remaining");
  });

  it("renders balance breakdown rows and points metadata, leaving the rewards earned to the summary", () => {
    const model = getPositionOverviewModel({
      locale: "en",
      now: null,
      integrationData: makeYield(),
      personalizedRewardRate: null,
      positionBalancesByType: makePositionBalances(),
      rewardsSummary: makeRewardsSummary({ last7D: "0.0123", total: "1.5" }),
      t: t as TFunction,
      validators: null,
    });

    expect(model.breakdownRows).toEqual([
      {
        id: "active-ETH-0",
        label: "Active",
        subValue: "$41,400.00",
        tone: "default",
        value: "12 ETH",
      },
      {
        id: "claimable-ETH-1",
        label: "Claimable",
        subValue: "$862.00",
        tone: "success",
        value: "0.25 ETH",
      },
      {
        id: "locked-PTS-2",
        label: "Locked",
        subValue: "Points",
        tone: "default",
        value: "42 PTS",
      },
    ]);
    // The summary's Earned caption carries the total; Details does not
    // repeat it.
    expect(model.detailRows.map((row) => row.id)).not.toContain(
      "rewards-total"
    );
  });
  it("names a deposit's balances as a deposit does", () => {
    const integrationData = makeYield();
    const model = getPositionOverviewModel({
      locale: "en",
      now: null,
      integrationData: {
        ...integrationData,
        mechanics: { ...integrationData.mechanics, type: "vault" },
      },
      personalizedRewardRate: null,
      positionBalancesByType: makePositionBalances(),
      t: t as TFunction,
      validators: null,
    });

    expect(model.breakdownRows[0]?.label).toBe("Deposited");
  });

  describe("Shares detail", () => {
    const usdc = {
      ...yieldApiYieldFixture().token,
      address: "0x00000000000000000000000000000000000000c1",
      decimals: 6,
      symbol: "USDC",
    };
    const steakUsdc = {
      ...usdc,
      address: "0x00000000000000000000000000000000000000c2",
      symbol: "steakUSDC",
    };
    const priced = (overrides: Parameters<typeof yieldBalanceFixture>[0]) => ({
      ...makeBalance(overrides),
      tokenPriceInUsd: new BigNumber(1),
    });
    const overview = (positionBalancesByType: PositionBalancesByType) =>
      getPositionOverviewModel({
        locale: "en",
        now: null,
        integrationData: makeYield(),
        personalizedRewardRate: null,
        positionBalancesByType,
        t: t as TFunction,
        validators: null,
      });

    it("lists a vault's Shares with their USD value under Details", () => {
      const model = overview(
        new Map([
          [
            "active",
            [
              priced({
                amount: "110",
                amountUsd: "110",
                shareAmount: "100",
                shareToken: steakUsdc,
                token: usdc,
                type: "active",
              }),
            ],
          ],
        ])
      );

      expect(model.detailRows.find((row) => row.id === "shares")).toEqual({
        id: "shares",
        label: "Shares",
        value: "100 steakUSDC ($110.00)",
      });
    });

    it("leaves Value Token balances out of the Shares", () => {
      const model = overview(
        new Map([
          [
            "active",
            [
              priced({
                amount: "110",
                amountUsd: "110",
                shareAmount: "100",
                shareToken: steakUsdc,
                token: usdc,
                type: "active",
              }),
            ],
          ],
          [
            "withdrawable",
            [
              priced({
                amount: "5",
                amountUsd: "5",
                token: usdc,
                type: "withdrawable",
              }),
            ],
          ],
        ])
      );
      expect(model.detailRows.find((row) => row.id === "shares")?.value).toBe(
        "100 steakUSDC ($110.00)"
      );
    });

    it("shows no USD value when a balance carrying Shares is unpriced", () => {
      const model = overview(
        new Map([
          [
            "active",
            [
              priced({
                amount: "110",
                amountUsd: null,
                shareAmount: "100",
                shareToken: steakUsdc,
                token: usdc,
                type: "active",
              }),
            ],
          ],
        ])
      );
      expect(model.detailRows.find((row) => row.id === "shares")?.value).toBe(
        "100 steakUSDC"
      );
    });

    it("hides Shares while they are encrypted", () => {
      const { cShare, cUsdc } = confidentialFixture;
      const model = overview(
        new Map([
          [
            "active",
            [
              priced({
                amount: "0",
                amountRaw: "0",
                isEncrypted: true,
                shareAmount: "0",
                shareAmountRaw: `0x${"ab".repeat(32)}`,
                shareToken: cShare,
                token: cUsdc,
                type: "active",
              }),
            ],
          ],
        ])
      );

      expect(model.detailRows.find((row) => row.id === "shares")).toMatchObject(
        { value: "Hidden" }
      );
    });

    it("is not hidden by an encrypted balance of the Value Token itself", () => {
      const { cUsdc } = confidentialFixture;
      const model = overview(
        new Map([
          [
            "active",
            [
              priced({
                amount: "110",
                amountUsd: "110",
                shareAmount: "100",
                shareToken: steakUsdc,
                token: usdc,
                type: "active",
              }),
            ],
          ],
          [
            "entering",
            [
              priced({
                amount: "0",
                amountRaw: "0",
                isEncrypted: true,
                shareAmount: "0",
                shareAmountRaw: `0x${"ab".repeat(32)}`,
                shareToken: cUsdc,
                token: cUsdc,
                type: "entering",
              }),
            ],
          ],
        ])
      );

      expect(
        model.detailRows.find((row) => row.id === "shares")?.value
      ).not.toBe("Hidden");
    });

    it("leaves unclaimed rewards out of the Shares but in the Balance", () => {
      const model = overview(
        new Map([
          [
            "active",
            [
              priced({
                amount: "110",
                amountUsd: "110",
                shareAmount: "100",
                shareToken: steakUsdc,
                token: usdc,
                type: "active",
              }),
            ],
          ],
          [
            "claimable",
            [
              priced({
                amount: "2",
                amountUsd: "2",
                token: usdc,
                type: "claimable",
              }),
            ],
          ],
        ])
      );
      expect(model.detailRows.find((row) => row.id === "shares")?.value).toBe(
        "100 steakUSDC ($110.00)"
      );
      expect(model.summary.subvalue).toBe("112 USDC");
    });

    it("has no Shares when every balance holds its Value Token", () => {
      const model = overview(makePositionBalances());

      expect(model.detailRows.some((row) => row.id === "shares")).toBe(false);
    });
  });
});

describe("the position's Earned rows", () => {
  const overview = (
    rewardsSummary: Parameters<
      typeof getPositionOverviewModel
    >[0]["rewardsSummary"]
  ) =>
    getPositionOverviewModel({
      locale: "en",
      integrationData: makeYield(),
      personalizedRewardRate: null,
      positionBalancesByType: makePositionBalances(),
      rewardsSummary,
      t: t as TFunction,
      validators: null,
    });
  const earnedOf = (model: ReturnType<typeof overview>) => {
    const rows = model.summary.rows.filter((row) => row.id !== "projected");
    return rows.length === 0 ? undefined : rows;
  };

  it("shows the week and all time in USD at the position's price, the token amount under each, before the projection", () => {
    const model = overview(
      makeRewardsSummary({ last7D: "0.0123", total: "1.5" })
    );

    // 12 ETH are worth $41,400: $3,450 an ETH.
    expect(model.summary.rows).toEqual([
      {
        id: "earned-week",
        label: "Earned · last 7 days",
        caption: "+0.0123 ETH",
        tone: "success",
        value: "+$42.44",
      },
      {
        id: "earned-total",
        label: "Earned · all time",
        caption: "+1.5 ETH",
        info: { label: "About earned", text: "Tracked since first indexed" },
        tone: "success",
        value: "+$5,175.00",
      },
      expect.objectContaining({ id: "projected" }),
    ]);
    expect(model.detailRows).toEqual([]);
  });

  it("shows a loss signed and in danger", () => {
    const [week] =
      earnedOf(overview(makeRewardsSummary({ last7D: "-0.5", total: "1" }))) ??
      [];

    expect(week).toMatchObject({
      caption: "\u22120.5 ETH",
      tone: "danger",
      value: "\u2212$1,725.00",
    });
  });

  it("shows the token amount alone when the position does not price the token", () => {
    const rows = earnedOf(
      overview(
        makeRewardsSummary({
          last7D: "2",
          token: { decimals: 10, network: "polkadot", symbol: "DOT" },
          total: "5",
        })
      )
    );

    expect(rows?.[0]).not.toHaveProperty("caption");
    expect(rows?.[0]?.value).toBe("+2 DOT");
    expect(rows?.[1]?.value).toBe("+5 DOT");
  });

  it("shows a quiet week neutrally, without a token amount, when earnings are tracked", () => {
    const [week] =
      earnedOf(overview(makeRewardsSummary({ last7D: "0", total: "1.5" }))) ??
      [];

    expect(week).not.toHaveProperty("caption");
    expect(week).toMatchObject({ tone: "default", value: "$0.00" });
  });

  it("hides when untracked, failed or loading, or when every window is zero", () => {
    const failure = Cause.fail("unavailable");
    for (const model of [
      overview(undefined),
      overview({ _tag: "Loading" }),
      overview({ _tag: "Failed", cause: failure }),
      overview({ ...makeRewardsSummary({}), value: Option.none() }),
      overview(makeRewardsSummary({})),
    ]) {
      expect(earnedOf(model)).toBeUndefined();
    }
  });

  it("hides an earlier figure once the latest attempt failed", () => {
    const earlier = makeRewardsSummary({ last7D: "0.0123", total: "1.5" });

    expect(earnedOf(overview(earlier))).toBeDefined();
    expect(
      earnedOf(
        overview({
          ...earlier,
          refreshFailure: Option.some(Cause.fail("unavailable")),
        })
      )
    ).toBeUndefined();
  });
});

describe("getPositionProviderName", () => {
  it("names the validator, else the yield's provider", () => {
    expect(
      getPositionProviderName({
        integrationData: makeYield(),
        providersDetails: [{ name: "Figment" }],
      })
    ).toBe("Figment");
    expect(
      getPositionProviderName({
        integrationData: makeYield(),
        providersDetails: [],
      })
    ).toBe("Rocket Pool");
  });
});
