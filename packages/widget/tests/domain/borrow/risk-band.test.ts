import BigNumber from "bignumber.js";
import { describe, expect, it } from "vitest";

import {
  classifyRiskBand,
  liquidationPriceDrop,
} from "../../../src/domain/borrow/risk/risk-band";

const band = ({
  healthFactor = null,
  ltv = null,
  maxLtv = null,
}: {
  readonly healthFactor?: string | null;
  readonly ltv?: string | null;
  readonly maxLtv?: string | null;
}) =>
  classifyRiskBand({
    healthFactor: healthFactor === null ? null : new BigNumber(healthFactor),
    ltv: ltv === null ? null : new BigNumber(ltv),
    maxLtv: maxLtv === null ? null : new BigNumber(maxLtv),
  });

describe("Borrow risk band", () => {
  it.each([
    ["2", "safe"],
    ["1.5", "safe"],
    ["1.4999", "caution"],
    ["1.1", "caution"],
    ["1.0999", "danger"],
    ["0.95", "danger"],
  ] as const)("reads a health factor of %s as %s", (healthFactor, expected) => {
    expect(band({ healthFactor })).toBe(expected);
  });

  it.each([
    ["0.5", "safe"],
    ["0.7199", "safe"],
    ["0.72", "caution"],
    ["0.8", "caution"],
    ["0.8001", "danger"],
    ["1", "danger"],
  ] as const)(
    "reads an LTV of %s against an 80%% max LTV as %s",
    (ltv, expected) => {
      expect(band({ ltv, maxLtv: "0.8" })).toBe(expected);
    }
  );

  it("takes the worse of the health factor and the LTV", () => {
    expect(band({ healthFactor: "2", ltv: "0.81", maxLtv: "0.8" })).toBe(
      "danger"
    );
    expect(band({ healthFactor: "1.03", ltv: "0.4", maxLtv: "0.8" })).toBe(
      "danger"
    );
    expect(band({ healthFactor: "1.3", ltv: "0.4", maxLtv: "0.8" })).toBe(
      "caution"
    );
  });

  it("reads a position at 92% LTV and health factor 1.03 as danger", () => {
    expect(band({ healthFactor: "1.03", ltv: "0.92", maxLtv: "0.8" })).toBe(
      "danger"
    );
  });

  it("has no band without debt", () => {
    expect(band({ ltv: "0", maxLtv: "0.8" })).toBeNull();
    expect(band({})).toBeNull();
  });

  it("judges an LTV alone without a known max LTV only at 100%", () => {
    expect(band({ ltv: "0.95" })).toBe("safe");
    expect(band({ ltv: "1" })).toBe("danger");
  });
});

describe("Liquidation price drop", () => {
  it("is the share of collateral value that brings the health factor to 1", () => {
    expect(liquidationPriceDrop(new BigNumber("1.25")).toString()).toBe("0.2");
    expect(liquidationPriceDrop(new BigNumber("2")).toString()).toBe("0.5");
  });

  it("is zero at or below a health factor of 1", () => {
    expect(liquidationPriceDrop(new BigNumber("1")).isZero()).toBe(true);
    expect(liquidationPriceDrop(new BigNumber("0.9")).isZero()).toBe(true);
  });
});
