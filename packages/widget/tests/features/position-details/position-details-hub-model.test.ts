import { describe, expect, it } from "vitest";
import {
  positionDetailsExitHasContent,
  positionDetailsHubHasContent,
  resolvePositionDetailsActionCapabilities,
  resolvePositionDetailsActionMode,
  resolveSelectedPositionDetailsActionMode,
  shouldShowPositionDetailsActionTabs,
} from "../../../src/features/position-details/model/hub";
import { yieldApiYieldFixture } from "../../fixtures";

describe("position details hub model", () => {
  it("defaults to exit when it is supported, else enter", () => {
    expect(
      resolvePositionDetailsActionMode({ canEnter: true, canExit: true })
    ).toBe("exit");
    expect(
      resolvePositionDetailsActionMode({ canEnter: true, canExit: false })
    ).toBe("enter");
    expect(
      resolvePositionDetailsActionMode({ canEnter: false, canExit: true })
    ).toBe("exit");
    expect(
      resolvePositionDetailsActionMode({ canEnter: false, canExit: false })
    ).toBe(null);
  });

  it("keeps an explicit tab selection when that action stays supported", () => {
    expect(
      resolveSelectedPositionDetailsActionMode({
        canEnter: true,
        canExit: true,
        selectedMode: "enter",
      })
    ).toBe("enter");
    expect(
      resolveSelectedPositionDetailsActionMode({
        canEnter: true,
        canExit: false,
        selectedMode: "exit",
      })
    ).toBe("enter");
  });

  it("shows action tabs only when both enter and exit are supported", () => {
    expect(
      shouldShowPositionDetailsActionTabs({ canEnter: true, canExit: true })
    ).toBe(true);
    expect(
      shouldShowPositionDetailsActionTabs({ canEnter: true, canExit: false })
    ).toBe(false);
    expect(
      shouldShowPositionDetailsActionTabs({ canEnter: false, canExit: true })
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
        exitBalance: { amount: 1 },
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
        exitBalance: { amount: 1 },
        unstakeToken: { symbol: "ETH" },
      } as never)
    ).toBe(true);
  });

  it("drops the exit capability when the position has no unstakeable balance", () => {
    const lockedOnly = {
      canChangeUnstakeAmount: true,
      canUnstake: true,
      integrationData: yieldApiYieldFixture({
        status: { enter: true, exit: true },
      }),
      pendingActions: [{ pendingAction: { type: "UNLOCK" } }],
      positionBalancesByType: new Map(),
      exitBalance: null,
      unstakeToken: null,
    } as never;

    const capabilities = resolvePositionDetailsActionCapabilities(lockedOnly);

    expect(capabilities).toEqual({ canEnter: true, canExit: false });
    expect(shouldShowPositionDetailsActionTabs(capabilities)).toBe(false);
    expect(
      resolveSelectedPositionDetailsActionMode({
        ...capabilities,
        selectedMode: null,
      })
    ).toBe("enter");
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
