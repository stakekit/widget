import { Cause, Option } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { describe, expect, it } from "vitest";
import type { MarketPosition } from "../../../src/domain/borrow/positions/market-position";
import { getUnifiedManagePositionsState } from "../../../src/features/portfolio/ui/dashboard/positions/model";
import { toPresentable } from "../../../src/shared/effect/async-result";

const positions = (count: number) =>
  Array.from({ length: count }, () => ({}) as MarketPosition);
const ready = (count = 0, options?: { readonly waiting?: boolean }) =>
  toPresentable(AsyncResult.success(positions(count), options));
const loading = toPresentable(AsyncResult.initial(true));
const failed = toPresentable(
  AsyncResult.failure<ReadonlyArray<MarketPosition>, string>(
    Cause.fail("offline")
  )
);
const refreshFailed = (count: number) =>
  toPresentable(
    AsyncResult.failure(Cause.fail("offline"), {
      previousSuccess: Option.some(AsyncResult.success(positions(count))),
    })
  );

const getState = (
  overrides: Partial<Parameters<typeof getUnifiedManagePositionsState>[0]> = {}
) =>
  getUnifiedManagePositionsState({
    borrowPositions: ready(),
    borrowWalletIsConnected: true,
    earnPositions: ready(),
    isConnected: true,
    isConnecting: false,
    ...overrides,
  });

describe("unified Manage positions state", () => {
  it("supports earn-only positions", () => {
    expect(getState({ earnPositions: ready(2) })).toMatchObject({
      hasPartialError: false,
      showEmptyPositions: false,
      showPositionsList: true,
      totalPositionsCount: 2,
    });
  });

  it("supports borrow-only positions", () => {
    expect(
      getState({ borrowPositions: ready(1), earnPositions: loading })
    ).toMatchObject({
      showEmptyPositions: false,
      showPositionsList: true,
      totalPositionsCount: 1,
    });
  });

  it("supports mixed earn and borrow positions", () => {
    expect(
      getState({ borrowPositions: ready(1), earnPositions: ready(2) })
        .totalPositionsCount
    ).toBe(3);
  });

  it("shows empty state only after both sources resolve without positions", () => {
    expect(getState()).toMatchObject({
      showEmptyPositions: true,
      totalPositionsCount: 0,
    });
  });

  it("surfaces partial errors while preserving available positions", () => {
    expect(
      getState({ borrowPositions: failed, earnPositions: ready(1) })
    ).toMatchObject({
      hasOnlyErrors: false,
      hasPartialError: true,
      showPositionsList: true,
      totalPositionsCount: 1,
    });
  });

  it("shows a full error when the only active source fails", () => {
    expect(
      getState({ borrowWalletIsConnected: false, earnPositions: failed })
    ).toMatchObject({
      hasOnlyErrors: true,
      hasPartialError: false,
      showEmptyPositions: false,
    });
  });

  it("shows incomplete portfolio data when one active source fails", () => {
    expect(getState({ earnPositions: failed })).toMatchObject({
      hasOnlyErrors: false,
      hasPartialError: true,
      showEmptyPositions: false,
      showPositionsList: true,
    });
  });

  it("keeps loading state from either module from becoming final empty", () => {
    expect(getState({ borrowPositions: loading })).toMatchObject({
      isAnyPositionsLoading: true,
      showEmptyPositions: false,
    });
  });

  it("keeps existing positions visible while earn refreshes", () => {
    expect(
      getState({ earnPositions: ready(1, { waiting: true }) })
    ).toMatchObject({
      isAnyPositionsLoading: false,
      showEmptyPositions: false,
      showPositionsList: true,
      totalPositionsCount: 1,
    });
  });

  it("keeps an empty list on screen while earn refreshes", () => {
    expect(
      getState({ earnPositions: ready(0, { waiting: true }) })
    ).toMatchObject({
      isAnyPositionsLoading: false,
      showEmptyPositions: true,
      showPositionsList: true,
    });
  });

  it("keeps existing positions visible while borrow refreshes", () => {
    expect(
      getState({
        borrowPositions: ready(1, { waiting: true }),
        earnPositions: ready(1),
      })
    ).toMatchObject({
      isAnyPositionsLoading: false,
      showEmptyPositions: false,
      showPositionsList: true,
      totalPositionsCount: 2,
    });
  });

  it("keeps positions over a failed refetch and flags the list incomplete", () => {
    expect(
      getState({
        borrowWalletIsConnected: false,
        earnPositions: refreshFailed(2),
      })
    ).toMatchObject({
      hasOnlyErrors: false,
      hasPartialError: true,
      showPositionsList: true,
      totalPositionsCount: 2,
    });
  });

  it("never replaces an empty list with the error screen when its refetch fails", () => {
    expect(
      getState({
        borrowWalletIsConnected: false,
        earnPositions: refreshFailed(0),
      })
    ).toMatchObject({
      hasOnlyErrors: false,
      hasPartialError: true,
      showPositionsList: true,
    });
  });

  it("shows loading only for the initial earn fetch", () => {
    expect(getState({ earnPositions: loading })).toMatchObject({
      isAnyPositionsLoading: true,
      showEmptyPositions: false,
    });
  });
});
