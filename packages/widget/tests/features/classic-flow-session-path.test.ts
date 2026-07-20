import { describe, expect, it } from "vitest";
import { isClassicFlowSessionPath } from "../../src/app/routes/classic-flow-session-path";

describe("Classic Flow Session route lifetime", () => {
  it.each([
    ["Enter", "/review"],
    ["Enter", "/steps"],
    ["Enter", "/complete"],
    ["Exit", "/positions/yield/balance/unstake/review"],
    ["Exit", "/positions/yield/balance/unstake/steps"],
    ["Manage", "/positions/yield/balance/pending-action/review"],
    ["Manage", "/positions/yield/balance/pending-action/complete"],
    ["ActivityResume", "/activity/review"],
    ["ActivityResume", "/activity/stake/steps"],
    ["ActivityResume", "/activity/unstake/complete"],
  ] as const)("keeps %s mounted at %s", (variant, pathname) => {
    expect(isClassicFlowSessionPath(pathname, variant)).toBe(true);
  });

  it("ends the route lifetime outside the matching journey", () => {
    expect(isClassicFlowSessionPath("/", "Enter")).toBe(false);
    expect(isClassicFlowSessionPath("/review", "Exit")).toBe(false);
    expect(isClassicFlowSessionPath("/activity", "ActivityResume")).toBe(false);
  });
});
