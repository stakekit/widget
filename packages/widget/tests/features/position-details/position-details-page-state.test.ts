import { Cause, Option } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { describe, expect, it } from "vitest";

import { resolvePositionDetailsPageState } from "../../../src/features/position-details/model/page-state";
import { toPresentable } from "../../../src/shared/effect/async-result";

const yieldValue = { id: "yield-1" };
const positionValue = { balances: [] };
const loadedYield = AsyncResult.success(yieldValue);
const loadedPosition = AsyncResult.success(positionValue);
const failure = () => Cause.fail("load failed");

const pageOf = ({
  position = loadedPosition,
  validatorsLoading = false,
  yieldOpportunity = loadedYield,
}: {
  readonly position?: AsyncResult.AsyncResult<unknown, unknown>;
  readonly validatorsLoading?: boolean;
  readonly yieldOpportunity?: AsyncResult.AsyncResult<unknown, unknown>;
}) =>
  resolvePositionDetailsPageState({
    position: toPresentable(position),
    validatorsLoading,
    yieldOpportunity: toPresentable(yieldOpportunity),
  });

describe("Position details page state", () => {
  it("is ready once the yield and the position have loaded", () => {
    expect(pageOf({})).toEqual({ _tag: "Ready" });
  });

  it("fails the page, rather than loading forever, when the yield's first load fails", () => {
    expect(
      pageOf({ yieldOpportunity: AsyncResult.failure(failure()) })
    ).toEqual({ _tag: "Failed" });
  });

  it("fails the page when the position's first load fails", () => {
    expect(pageOf({ position: AsyncResult.failure(failure()) })).toEqual({
      _tag: "Failed",
    });
  });

  it("keeps showing the position when a refetch fails after it loaded", () => {
    expect(
      pageOf({
        yieldOpportunity: AsyncResult.failure(failure(), {
          previousSuccess: Option.some(loadedYield),
        }),
      })
    ).toEqual({ _tag: "Ready" });
  });

  it("loads while a failed first load retries", () => {
    expect(
      pageOf({
        yieldOpportunity: AsyncResult.failure(failure(), { waiting: true }),
      })
    ).toEqual({ _tag: "Loading" });
  });

  it("loads while the exit's validators are on their first load", () => {
    expect(pageOf({ validatorsLoading: true })).toEqual({ _tag: "Loading" });
  });

  it("leaves for the list once a settled load finds no position", () => {
    expect(pageOf({ position: AsyncResult.success(null) })).toEqual({
      _tag: "PositionLost",
    });
  });

  it("leaves for the list when there is no yield to show the position of", () => {
    expect(pageOf({ yieldOpportunity: AsyncResult.success(null) })).toEqual({
      _tag: "PositionLost",
    });
  });

  it("does not call a missing position lost while a refetch may still bring it", () => {
    expect(
      pageOf({ position: AsyncResult.success(null, { waiting: true }) })
    ).toEqual({ _tag: "Loading" });
    expect(
      pageOf({
        position: AsyncResult.failure(failure(), {
          previousSuccess: Option.some(AsyncResult.success(null)),
        }),
      })
    ).toEqual({ _tag: "Failed" });
  });
});
