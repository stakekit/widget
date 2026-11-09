import { describe, expect, it } from "vitest";

import {
  formatPositionCallout,
  getPositionCallout,
  type InactiveValidatorStatus,
  type PositionAttention,
} from "../../../src/domain/portfolio/position-callout";
import { createWidgetI18nInstance } from "../../../src/services/translation/widget-translation";

const t = createWidgetI18nInstance().getFixedT("en");

const calm: PositionAttention = {
  hasPendingClaimRewards: false,
  hasPendingRequest: false,
  requiredAction: null,
};

const label = (
  attention: Partial<PositionAttention>,
  inactiveValidator: InactiveValidatorStatus | null = null
) => {
  const callout = getPositionCallout({
    attention: { ...calm, ...attention },
    inactiveValidator,
  });
  return callout === null ? null : formatPositionCallout(callout, t);
};

describe("Position row callout", () => {
  it.each([
    {
      attention: { requiredAction: "withdraw" },
      expected: "Ready to withdraw",
    },
    { attention: { requiredAction: "unlock" }, expected: "Ready to unlock" },
    { attention: { requiredAction: "locked" }, expected: "Locked balance" },
    { attention: { requiredAction: "other" }, expected: "Action required" },
    {
      attention: { hasPendingClaimRewards: true },
      expected: "Rewards to claim",
    },
    { attention: { hasPendingRequest: true }, expected: "In progress" },
  ] as const)("reads $expected", ({ attention, expected }) => {
    expect(label(attention)).toBe(expected);
  });

  it.each([
    {
      attention: { hasPendingClaimRewards: true, requiredAction: "other" },
      expected: "Action required",
      inactiveValidator: "jailed",
    },
    {
      attention: { hasPendingClaimRewards: true },
      expected: "Jailed",
      inactiveValidator: "jailed",
    },
    {
      attention: { hasPendingClaimRewards: true },
      expected: "Inactive",
      inactiveValidator: "other",
    },
    {
      attention: { hasPendingClaimRewards: true, hasPendingRequest: true },
      expected: "Rewards to claim",
      inactiveValidator: null,
    },
  ] as const)(
    "calls out only the most pressing status: $expected",
    ({ attention, expected, inactiveValidator }) => {
      expect(label(attention, inactiveValidator)).toBe(expected);
    }
  );

  it("calls out nothing without a status", () => {
    expect(label({})).toBeNull();
  });
});
