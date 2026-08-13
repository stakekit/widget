import { describe, expect, it } from "vitest";
import {
  getPositionDetailsHubPath,
  positionDetailsExitHasContent,
  positionDetailsHubHasContent,
  resolvePositionDetailsActionMode,
  resolveSelectedPositionDetailsActionMode,
  shouldShowPositionDetailsActionTabs,
} from "../../src/features/position-details/model/hub";
import { yieldApiYieldFixture } from "../fixtures";

describe("position details hub model", () => {
  it("builds the bare position details hub path", () => {
    expect(
      getPositionDetailsHubPath({
        balanceId: "balance-1",
        integrationId: "yield-1",
      })
    ).toBe("/positions/yield-1/balance-1");
  });

  it("defaults to unstake when exit is supported, else stake", () => {
    expect(
      resolvePositionDetailsActionMode({ canStake: true, canUnstake: true })
    ).toBe("unstake");
    expect(
      resolvePositionDetailsActionMode({ canStake: true, canUnstake: false })
    ).toBe("stake");
    expect(
      resolvePositionDetailsActionMode({ canStake: false, canUnstake: true })
    ).toBe("unstake");
    expect(
      resolvePositionDetailsActionMode({ canStake: false, canUnstake: false })
    ).toBe(null);
  });

  it("keeps an explicit tab selection when that action stays supported", () => {
    expect(
      resolveSelectedPositionDetailsActionMode({
        canStake: true,
        canUnstake: true,
        selectedMode: "stake",
      })
    ).toBe("stake");
    expect(
      resolveSelectedPositionDetailsActionMode({
        canStake: true,
        canUnstake: false,
        selectedMode: "unstake",
      })
    ).toBe("stake");
  });

  it("shows action tabs only when both stake and exit are supported", () => {
    expect(
      shouldShowPositionDetailsActionTabs({ canStake: true, canUnstake: true })
    ).toBe(true);
    expect(
      shouldShowPositionDetailsActionTabs({ canStake: true, canUnstake: false })
    ).toBe(false);
    expect(
      shouldShowPositionDetailsActionTabs({ canStake: false, canUnstake: true })
    ).toBe(false);
  });

  it("treats exit support as exit capability, not pending actions", () => {
    expect(
      positionDetailsExitHasContent({
        canChangeUnstakeAmount: true,
        canUnstake: false,
        integrationData: yieldApiYieldFixture({
          status: { enter: false, exit: false },
        }),
        pendingActions: [{ pendingAction: { type: "CLAIM_REWARDS" } }],
        positionBalancesByType: new Map(),
        reducedStakedOrLiquidBalance: { amount: 1 },
        unstakeToken: { symbol: "ETH" },
      } as never)
    ).toBe(false);

    expect(
      positionDetailsExitHasContent({
        canChangeUnstakeAmount: true,
        canUnstake: true,
        integrationData: yieldApiYieldFixture({
          status: { enter: false, exit: true },
        }),
        pendingActions: [],
        positionBalancesByType: new Map(),
        reducedStakedOrLiquidBalance: { amount: 1 },
        unstakeToken: { symbol: "ETH" },
      } as never)
    ).toBe(true);
  });

  it("treats the hub as actionable when exit is supported even without form readiness", () => {
    expect(
      positionDetailsHubHasContent({
        canUnstake: true,
        integrationData: yieldApiYieldFixture({
          status: { enter: false, exit: true },
        }),
        pendingActions: [],
      })
    ).toBe(true);

    expect(
      positionDetailsHubHasContent({
        canUnstake: false,
        integrationData: yieldApiYieldFixture({
          status: { enter: false, exit: false },
        }),
        pendingActions: [],
      })
    ).toBe(false);

    expect(
      positionDetailsHubHasContent({
        canUnstake: false,
        integrationData: yieldApiYieldFixture({
          status: { enter: false, exit: false },
        }),
        pendingActions: [{ pendingAction: { type: "CLAIM_REWARDS" } }],
      })
    ).toBe(true);
  });
});
