import { DateTime, Schema } from "effect";
import { describe, expect, it } from "vitest";

import { EarnBalance } from "../../../src/domain/earn/balance";
import { exactDecimal } from "../../../src/domain/finance/exact";
import type { PositionBalancesByType } from "../../../src/domain/portfolio/positions";
import { formatPendingBalanceTiming } from "../../../src/features/position-details/model/pending-balance-timing";
import { getPositionOverviewModel } from "../../../src/features/position-details/model/position-overview";
import { createWidgetI18nInstance } from "../../../src/services/translation/widget-translation";
import {
  yieldApiYieldFixture,
  yieldBalanceFixture,
  yieldRewardRateFixture,
} from "../../fixtures";

const t = createWidgetI18nInstance().getFixedT("en");
const integrationData = yieldApiYieldFixture({
  id: "ethereum-wbtc-dbit-makina-vault",
  providerId: "makina",
  rewardRate: yieldRewardRateFixture({ total: 0.05 }),
});
const now = DateTime.makeUnsafe("2026-11-11T12:00:00Z");
const date = DateTime.makeUnsafe("2026-11-08T18:02:59Z");
const timing = (
  overrides: Partial<Parameters<typeof formatPendingBalanceTiming>[0]> = {}
) =>
  formatPendingBalanceTiming({
    integrationData,
    locale: "en",
    now,
    row: { cancelling: false, date, type: "exiting" },
    t,
    ...overrides,
  });

describe("Makina pending withdrawal timing", () => {
  it.each([date, now])(
    "keeps the estimated date and awaits finalization at or after unlock (%s)",
    (value) => {
      expect(timing({ now: value })).toBe(
        "Estimated unlock: Nov 8, 2026, 18:02 GMT · Awaiting finalization by Makina"
      );
    }
  );

  it("labels a future unlock as estimated without claiming it has finalized", () => {
    expect(timing({ now: DateTime.makeUnsafe("2026-11-07T12:00:00Z") })).toBe(
      "Estimated unlock: Nov 8, 2026, 18:02 GMT"
    );
  });

  it("does not invent a date when the API provides none", () => {
    expect(
      timing({ row: { cancelling: false, date: undefined, type: "exiting" } })
    ).toBe("Awaiting finalization by Makina");
  });

  it("preserves cancellation and settled balance presentation", () => {
    expect(timing({ row: { cancelling: true, date, type: "exiting" } })).toBe(
      "Cancelling…"
    );
    expect(
      timing({ row: { cancelling: false, date, type: "withdrawable" } })
    ).toBeNull();
  });

  it("preserves other providers' existing timing", () => {
    expect(timing({ integrationData: yieldApiYieldFixture() })).toBe(
      "Imminent"
    );
  });
});

const makeBalance = (
  isEarning: boolean,
  amount: string,
  type: "active" | "exiting"
) => ({
  ...Schema.decodeSync(EarnBalance)(
    yieldBalanceFixture({
      amount,
      amountUsd: amount,
      isEarning,
      type,
      token: integrationData.token,
    })
  ),
  tokenPriceInUsd: exactDecimal(1),
});

const overview = (positionBalancesByType: PositionBalancesByType) =>
  getPositionOverviewModel({
    integrationData,
    locale: "en",
    now,
    positionBalancesByType,
    t,
    validators: null,
  });

describe("position reward eligibility", () => {
  it("keeps the value but hides APY and projections for non-earning exits", () => {
    const actual = overview(
      new Map([["exiting", [makeBalance(false, "1000", "exiting")]]])
    );
    expect(actual.summary.value).toBe("$1,000.00");
    expect(actual.summary.rate).toBeUndefined();
    expect(actual.summary.rows).toEqual([]);
    expect(actual.hasEarningBalances).toBe(false);
    expect(actual.omittedYieldFacts).toContain("reward-rate");
  });

  it("keeps APY for active funds and projects only the earning portion", () => {
    const actual = overview(
      new Map([
        ["active", [makeBalance(true, "100", "active")]],
        ["exiting", [makeBalance(false, "900", "exiting")]],
      ])
    );
    expect(actual.summary.value).toBe("$1,000.00");
    expect(actual.summary.rate).toBe("5.00% APY");
    expect(
      actual.summary.rows.find((row) => row.id === "projected")?.value
    ).toBe("≈ $5.00");
    expect(actual.hasEarningBalances).toBe(true);
  });

  it("respects the API flag rather than assuming every exit stops earning", () => {
    const actual = overview(
      new Map([["exiting", [makeBalance(true, "100", "exiting")]]])
    );
    expect(actual.summary.rate).toBe("5.00% APY");
  });
});
