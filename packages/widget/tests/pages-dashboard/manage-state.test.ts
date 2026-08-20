import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { describe, expect, it } from "vitest";
import type { MarketPosition } from "../../src/domain/borrow/positions/market-position";
import { getUnifiedManagePositionsState } from "../../src/features/portfolio/ui/dashboard/positions/model";

const borrowPositionsResult = (positions: ReadonlyArray<MarketPosition> = []) =>
  AsyncResult.success<ReadonlyArray<MarketPosition>, unknown>(positions);

const getState = (
  overrides: Partial<Parameters<typeof getUnifiedManagePositionsState>[0]> = {}
) =>
  getUnifiedManagePositionsState({
    borrowPositionsResult: borrowPositionsResult(),
    borrowWalletIsConnected: true,
    earnIsError: false,
    earnIsFetching: false,
    earnIsLoading: false,
    earnPositionsCount: 0,
    isConnected: true,
    isConnecting: false,
    showEarnPositions: true,
    ...overrides,
  });

describe("unified Manage positions state", () => {
  it("supports earn-only positions", () => {
    expect(
      getState({
        earnPositionsCount: 2,
      })
    ).toMatchObject({
      hasPartialError: false,
      showEmptyPositions: false,
      showPositionsList: true,
      totalPositionsCount: 2,
    });
  });

  it("supports borrow-only positions", () => {
    expect(
      getState({
        borrowPositionsResult: borrowPositionsResult([{} as MarketPosition]),
        showEarnPositions: false,
      })
    ).toMatchObject({
      showEmptyPositions: false,
      showPositionsList: true,
      totalPositionsCount: 1,
    });
  });

  it("supports mixed earn and borrow positions", () => {
    expect(
      getState({
        borrowPositionsResult: borrowPositionsResult([{} as MarketPosition]),
        earnPositionsCount: 2,
      }).totalPositionsCount
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
      getState({
        borrowPositionsResult: AsyncResult.fail<
          unknown,
          ReadonlyArray<MarketPosition>
        >("borrow failed"),
        earnPositionsCount: 1,
      })
    ).toMatchObject({
      hasOnlyErrors: false,
      hasPartialError: true,
      showPositionsList: true,
      totalPositionsCount: 1,
    });
  });

  it("shows a full error when the only active source fails", () => {
    expect(
      getState({
        borrowWalletIsConnected: false,
        earnIsError: true,
        showEarnPositions: false,
      })
    ).toMatchObject({
      hasOnlyErrors: true,
      hasPartialError: false,
      showEmptyPositions: false,
    });
  });

  it("shows incomplete portfolio data when one active source fails", () => {
    expect(
      getState({
        earnIsError: true,
        showEarnPositions: false,
      })
    ).toMatchObject({
      hasOnlyErrors: false,
      hasPartialError: true,
      showEmptyPositions: false,
      showPositionsList: true,
    });
  });

  it("keeps loading state from either module from becoming final empty", () => {
    expect(
      getState({
        borrowPositionsResult: AsyncResult.initial<
          ReadonlyArray<MarketPosition>,
          unknown
        >(true),
      })
    ).toMatchObject({
      isAnyPositionsLoading: true,
      showEmptyPositions: false,
    });
  });
});
