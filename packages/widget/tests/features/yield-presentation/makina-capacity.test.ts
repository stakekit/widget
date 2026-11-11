import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import { EarnYield } from "../../../src/domain/earn/yield-schema";
import { getYieldFacts } from "../../../src/features/yield-presentation/model/yield-facts";
import { createWidgetI18nInstance } from "../../../src/services/translation/widget-translation";
import { yieldApiYieldDtoFixture } from "../../fixtures";

const makeYield = (capacityState: unknown, providerId = "makina") =>
  Schema.decodeSync(EarnYield)({
    ...yieldApiYieldDtoFixture({ providerId }),
    token: {
      name: "Wrapped Bitcoin",
      symbol: "wBTC",
      network: "ethereum",
      decimals: 8,
      address: "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599",
    },
    state: { capacityState },
  });

const capacityFact = (
  capacityState: unknown,
  locale = "en",
  providerId = "makina"
) =>
  getYieldFacts({
    locale,
    t: createWidgetI18nInstance().getFixedT(locale),
    yieldDto: makeYield(capacityState, providerId),
  }).find((fact) => fact.id === "capacity");

describe("Makina capacity presentation", () => {
  it("shows used and maximum capacity in token units, with available capacity", () => {
    expect(
      capacityFact({ current: "1.5", max: "2", remaining: "0.5" })
    ).toEqual({
      id: "capacity",
      label: "Capacity",
      notable: true,
      value: "1.5 wBTC / 2 wBTC",
      subValue: "0.5 wBTC available",
    });
  });

  it("shows a full vault and handles zero capacity without dividing by zero", () => {
    expect(
      capacityFact({ current: "2", max: "2", remaining: "0" })?.subValue
    ).toBe("Full");
    expect(
      capacityFact({ current: "0", max: "0", remaining: "0" })?.value
    ).toBe("0 wBTC / 0 wBTC");
  });

  it("labels only explicitly unlimited capacity as unlimited", () => {
    expect(
      capacityFact({ current: "1.5", max: null, remaining: null })?.value
    ).toBe("Unlimited");
    expect(capacityFact({ current: "1.5" })?.value).toBe("Limit unavailable");
    expect(capacityFact({ current: "1.5", remaining: "0.5" })?.value).toBe(
      "0.5 wBTC available"
    );
  });

  it.each([
    undefined,
    null,
    { current: "invalid", max: "2" },
    { current: "1", max: "invalid", remaining: null },
    { current: "1", max: null, remaining: "invalid" },
    { current: "-1", max: "2", remaining: "3" },
    { current: "1", remaining: "-1" },
  ])("drops only missing or invalid capacity: %j", (input) => {
    expect(capacityFact(input)).toBeUndefined();
    expect(makeYield(input).metadata.name).toBeDefined();
  });

  it("preserves other providers' facts", () => {
    expect(
      capacityFact({ current: "1", max: "2", remaining: "1" }, "en", "lido")
    ).toBeUndefined();
  });
});
