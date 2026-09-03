import { describe, expect, it } from "vitest";
import {
  resolveTabResourcesPrefetchLanding,
  shouldWarmTabResources,
} from "../../src/app/routes/model/tab-resources-prefetch-gate";

describe("tab resources prefetch gate", () => {
  it("maps dashboard and classic tab paths to landing tabs", () => {
    expect(resolveTabResourcesPrefetchLanding("/")).toBe("earn");
    expect(resolveTabResourcesPrefetchLanding("/borrow")).toBe("borrow");
    expect(resolveTabResourcesPrefetchLanding("/borrow/markets/1")).toBe(
      "borrow"
    );
    expect(resolveTabResourcesPrefetchLanding("/positions")).toBe("manage");
    expect(
      resolveTabResourcesPrefetchLanding("/positions/yield-1/balance-1")
    ).toBe("manage");
    expect(resolveTabResourcesPrefetchLanding("/activity")).toBe("activity");
    expect(resolveTabResourcesPrefetchLanding("/activity/action-1")).toBe(
      "activity"
    );
    expect(resolveTabResourcesPrefetchLanding("/review")).toBe("other");
  });

  it("does not warm without a wallet scope", () => {
    expect(
      shouldWarmTabResources({
        hasScope: false,
        tab: "manage",
        earnTokensReady: true,
        borrowMarketsReady: true,
      })
    ).toBe(false);
  });

  it("waits for Earn token catalog readiness on Earn", () => {
    expect(
      shouldWarmTabResources({
        hasScope: true,
        tab: "earn",
        earnTokensReady: false,
        borrowMarketsReady: false,
      })
    ).toBe(false);
    expect(
      shouldWarmTabResources({
        hasScope: true,
        tab: "earn",
        earnTokensReady: true,
        borrowMarketsReady: false,
      })
    ).toBe(true);
  });

  it("waits for Borrow markets readiness on Borrow", () => {
    expect(
      shouldWarmTabResources({
        hasScope: true,
        tab: "borrow",
        earnTokensReady: true,
        borrowMarketsReady: false,
      })
    ).toBe(false);
    expect(
      shouldWarmTabResources({
        hasScope: true,
        tab: "borrow",
        earnTokensReady: false,
        borrowMarketsReady: true,
      })
    ).toBe(true);
  });

  it("warms immediately on Manage or Activity once scoped", () => {
    expect(
      shouldWarmTabResources({
        hasScope: true,
        tab: "manage",
        earnTokensReady: false,
        borrowMarketsReady: false,
      })
    ).toBe(true);
    expect(
      shouldWarmTabResources({
        hasScope: true,
        tab: "activity",
        earnTokensReady: false,
        borrowMarketsReady: false,
      })
    ).toBe(true);
  });

  it("does not warm unrelated routes", () => {
    expect(
      shouldWarmTabResources({
        hasScope: true,
        tab: "other",
        earnTokensReady: true,
        borrowMarketsReady: true,
      })
    ).toBe(false);
  });
});
