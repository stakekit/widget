import BigNumber from "bignumber.js";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import { EarnBalance } from "../../src/domain/earn/models";
import {
  getPositionDetailsHubPath,
  positionDetailsExitHasContent,
  positionDetailsPendingHasContent,
  resolvePositionDetailsPageLayout,
} from "../../src/features/position-details/model/hub";
import { yieldApiYieldFixture, yieldBalanceFixture } from "../fixtures";

const balance = Schema.decodeSync(EarnBalance)(
  yieldBalanceFixture({ amount: "2", amountUsd: "5" })
);

const makeView = (overrides: Record<string, unknown> = {}) =>
  ({
    canChangeUnstakeAmount: true,
    canUnstake: false,
    integrationData: yieldApiYieldFixture({
      status: { enter: false, exit: false },
    }),
    pendingActions: [],
    positionBalancesByType: new Map(),
    reducedStakedOrLiquidBalance: {
      amount: new BigNumber(2),
      amountUsd: new BigNumber(5),
      token: balance.token,
    },
    unstakeToken: balance.token,
    ...overrides,
  }) as never;

describe("position details action content", () => {
  it("does not treat an unavailable exit as an available action", () => {
    const view = makeView();

    expect(positionDetailsExitHasContent(view)).toBe(false);
    expect(
      resolvePositionDetailsPageLayout({
        flowActive: false,
        integrationData: yieldApiYieldFixture({
          status: { enter: false, exit: false },
        }),
        isLoading: false,
        positionBalancesByType: new Map(),
        positionLost: false,
      })
    ).toBe("Actions");
  });

  it("keeps a real pending action in the action pane", () => {
    expect(
      positionDetailsPendingHasContent(
        makeView({
          pendingActions: [{ pendingAction: { type: "CLAIM_REWARDS" } }],
        })
      )
    ).toBe(true);
  });

  it("keeps an available exit in the action pane", () => {
    expect(
      positionDetailsExitHasContent(
        makeView({
          canUnstake: true,
          integrationData: yieldApiYieldFixture({
            status: { enter: false, exit: true },
          }),
        })
      )
    ).toBe(true);
  });

  it("leaves the details page once the position is gone", () => {
    expect(
      resolvePositionDetailsPageLayout({
        flowActive: false,
        integrationData: yieldApiYieldFixture(),
        isLoading: false,
        positionBalancesByType: null,
        positionLost: true,
      })
    ).toBe("PositionLost");
  });

  it("keeps an active flow mounted when its exit removes the position", () => {
    expect(
      resolvePositionDetailsPageLayout({
        flowActive: true,
        integrationData: yieldApiYieldFixture(),
        isLoading: false,
        positionBalancesByType: null,
        positionLost: true,
      })
    ).toBe("Actions");
  });

  it("shows only details when the position cannot be resolved", () => {
    expect(
      resolvePositionDetailsPageLayout({
        flowActive: false,
        integrationData: null,
        isLoading: false,
        positionBalancesByType: null,
        positionLost: false,
      })
    ).toBe("InfoOnly");
  });

  it("builds the position hub path", () => {
    expect(
      getPositionDetailsHubPath({
        balanceId: "balance-1",
        integrationId: "yield-1",
      })
    ).toBe("/positions/yield-1/balance-1");
  });
});
