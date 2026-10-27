import { Option, Schema } from "effect";
import { describe, expect, it } from "vitest";
import { YieldId } from "../../../src/domain/identity/identifiers";
import {
  isWidgetPath,
  widgetRoutes,
  widgetYieldFlowRoutes,
} from "../../../src/services/navigation/widget-routes";

describe("widget route registry", () => {
  it("round-trips params that need encoding", () => {
    const params = {
      balanceId: "a/b c?%",
      integrationId: Schema.decodeSync(YieldId)("eth-lido#1"),
    };
    const path = widgetRoutes.positionDetails.build(params);

    expect(path).toBe("/positions/eth-lido%231/a%2Fb%20c%3F%25");
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
      balanceId: "balance-1",
      integrationId: Schema.decodeSync(YieldId)("yield-1"),
    };
    const { completePath, reviewPath, stepsPath } = flow.at(params);
    const other = flow.at({ ...params, balanceId: "balance-2" });

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
});
