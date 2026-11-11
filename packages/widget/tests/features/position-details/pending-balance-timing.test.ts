import { DateTime, Struct } from "effect";
import { describe, expect, it } from "vitest";

import { formatPendingBalanceTiming } from "../../../src/features/position-details/model/pending-balance-timing";
import { createWidgetI18nInstance } from "../../../src/services/translation/widget-translation";
import { yieldApiProviderFixture, yieldApiYieldFixture } from "../../fixtures";

const t = createWidgetI18nInstance().getFixedT("en");
const makina = {
  ...yieldApiYieldFixture({
    id: "ethereum-wbtc-dbit-makina-vault",
    providerId: "makina",
  }),
  provider: yieldApiProviderFixture({ name: "Makina" }),
};
// One hour east of UTC, so a date shown in UTC would read an hour early.
const timeZone = DateTime.zoneMakeOffset(60 * 60 * 1000);
const presentationAt = (iso: string) => ({
  now: DateTime.makeUnsafe(iso),
  timeZone,
});
const date = DateTime.makeUnsafe("2026-11-08T18:02:59Z");
const timing = (
  overrides: Partial<Parameters<typeof formatPendingBalanceTiming>[0]> = {}
) =>
  formatPendingBalanceTiming({
    integrationData: makina,
    locale: "en",
    presentationTime: presentationAt("2026-11-11T12:00:00Z"),
    row: { cancelling: false, date, type: "exiting" },
    t,
    ...overrides,
  });

describe("Makina pending withdrawal timing", () => {
  it.each(["2026-11-08T18:02:59Z", "2026-11-11T12:00:00Z"])(
    "keeps the estimated date and awaits finalization at or after unlock (%s)",
    (now) => {
      expect(timing({ presentationTime: presentationAt(now) })).toBe(
        "Estimated unlock: Nov 8, 2026, 7:02 PM · Awaiting finalization by Makina"
      );
    }
  );

  it("labels a future unlock as estimated, in the user's time zone", () => {
    expect(
      timing({ presentationTime: presentationAt("2026-11-07T12:00:00Z") })
    ).toBe("Estimated unlock: Nov 8, 2026, 7:02 PM");
  });

  it("does not invent a date when the API provides none", () => {
    expect(
      timing({ row: { cancelling: false, date: undefined, type: "exiting" } })
    ).toBe("Awaiting finalization by Makina");
  });

  it("names the provider by its ID when the API gives no provider", () => {
    expect(
      timing({
        integrationData: Struct.omit(makina, ["provider"]),
        row: { cancelling: false, date: undefined, type: "exiting" },
      })
    ).toBe("Awaiting finalization by makina");
  });

  it("shows no date without presentation time", () => {
    expect(timing({ presentationTime: null })).toBeNull();
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
