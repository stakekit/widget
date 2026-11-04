import { Option, Schema } from "effect";
import { describe, expect, it } from "vitest";
import { YieldId } from "../../../src/domain/identity/identifiers";
import { BalanceDataKey } from "../../../src/domain/portfolio/positions";
import {
  isWidgetPath,
  widgetRoutes,
  widgetYieldFlowRoutes,
} from "../../../src/services/navigation/widget-routes";

describe("widget route registry", () => {
  it("round-trips params that need encoding", () => {
    const params = {
      balanceId: Schema.decodeSync(BalanceDataKey)("validator::a/b c?%"),
      integrationId: Schema.decodeSync(YieldId)("eth-lido#1"),
    };
    const path = widgetRoutes.positionDetails.build(params);

    expect(path).toBe("/positions/eth-lido%231/validator%3A%3Aa%2Fb%20c%3F%25");
    expect(widgetRoutes.positionDetails.match(path)).toEqual(
      Option.some(params)
    );
  });

  it("does not match malformed encodings or branded ids that fail decoding", () => {
    expect(
      Option.isNone(widgetRoutes.positionDetails.match("/positions/%E0/b"))
    ).toBe(true);
    expect(
      Option.isNone(
        widgetRoutes.activityAction.match(`/activity/${encodeURIComponent("")}`)
      )
    ).toBe(true);
  });

  it("decodes a position balance key and rejects one outside its grammar", () => {
    const integrationId = Schema.decodeSync(YieldId)("yield-1");

    expect(
      widgetRoutes.positionDetails.match(
        "/positions/yield-1/validator::val-1:7"
      )
    ).toEqual(Option.some({ balanceId: "validator::val-1:7", integrationId }));
    expect(
      widgetRoutes.positionDetails.match("/positions/yield-1/default")
    ).toEqual(Option.some({ balanceId: "default", integrationId }));
    for (const balanceId of ["balance-1", "validator::", "validator:val-1"]) {
      expect(
        Option.isNone(
          widgetRoutes.positionDetails.match(`/positions/yield-1/${balanceId}`)
        )
      ).toBe(true);
    }
  });

  it("matches exactly, tolerating a trailing slash, or as a section prefix", () => {
    const route = widgetRoutes.positions;

    expect(Option.isSome(route.match("/positions/"))).toBe(true);
    expect(Option.isNone(route.match("/positions/yield-1/balance-1"))).toBe(
      true
    );
    expect(
      Option.isSome(route.matchPrefix("/positions/yield-1/balance-1"))
    ).toBe(true);
    expect(Option.isNone(route.matchPrefix("/positionsx"))).toBe(true);
    expect(isWidgetPath("/positions/", route.build())).toBe(true);
  });

  it("keys a flow mount's Review, Steps, and Complete alike", () => {
    const flow = widgetYieldFlowRoutes.PositionExit;
    const params = {
      balanceId: Schema.decodeSync(BalanceDataKey)("default"),
      integrationId: Schema.decodeSync(YieldId)("yield-1"),
    };
    const { completePath, reviewPath, stepsPath } = flow.at(params);
    const other = flow.at({
      ...params,
      balanceId: Schema.decodeSync(BalanceDataKey)("validators"),
    });

    const key = flow.mountKey(reviewPath);
    expect(key).toEqual(
      Option.some(widgetRoutes.positionUnstake.build(params))
    );
    expect(flow.mountKey(stepsPath)).toEqual(key);
    expect(flow.mountKey(completePath)).toEqual(key);
    expect(flow.mountKey(other.reviewPath)).not.toEqual(key);
    expect(
      Option.isNone(flow.mountKey(widgetRoutes.positionUnstake.build(params)))
    ).toBe(true);
  });

  it("decodes a borrow position action key and rejects an unknown one", () => {
    const route = widgetRoutes.borrowPositionAction;

    expect(
      route.match("/positions/borrow/market-1/action/repay-0xabc")
    ).toEqual(Option.some({ actionId: "repay-0xabc", marketId: "market-1" }));
    expect(
      Option.isSome(route.match("/positions/borrow/market-1/action/withdraw"))
    ).toBe(true);
    expect(
      Option.isNone(
        route.match("/positions/borrow/market-1/action/borrow-0xabc")
      )
    ).toBe(true);
    expect(
      Option.isNone(route.match("/positions/borrow/market-1/action/repay-"))
    ).toBe(true);
  });
});
