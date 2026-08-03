import BigNumber from "bignumber.js";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import { EarnBalance } from "../../src/domain/schema/earn-models";
import { positionDetailsPageShouldShowActionsPane } from "../../src/features/position-details/ui/dashboard";
import {
  getPositionDetailsRootPath,
  positionDetailsActionsHasContent,
  shouldRedirectFromPositionDetailsActions,
} from "../../src/features/position-details/ui/dashboard/components/position-details-actions";
import { yieldApiYieldFixture, yieldBalanceFixture } from "../fixtures";

const balance = Schema.decodeUnknownSync(EarnBalance)(
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

    expect(positionDetailsActionsHasContent(view)).toBe(false);
    expect(shouldRedirectFromPositionDetailsActions(view)).toBe(true);
    expect(positionDetailsPageShouldShowActionsPane(view)).toBe(true);
  });

  it("keeps a real pending action in the action pane", () => {
    expect(
      positionDetailsActionsHasContent(
        makeView({
          pendingActions: [{ pendingActionDto: { type: "CLAIM_REWARDS" } }],
        })
      )
    ).toBe(true);
  });

  it("keeps an available exit in the action pane", () => {
    expect(
      positionDetailsActionsHasContent(
        makeView({
          canUnstake: true,
          integrationData: yieldApiYieldFixture({
            status: { enter: false, exit: true },
          }),
        })
      )
    ).toBe(true);
  });

  it("redirects to the position root path", () => {
    expect(
      getPositionDetailsRootPath({
        balanceId: "balance-1",
        integrationId: "yield-1",
      })
    ).toBe("/positions/yield-1/balance-1");
  });
});
