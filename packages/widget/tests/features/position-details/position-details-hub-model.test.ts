import { describe, expect, it } from "vitest";
import {
  positionDetailsExitHasContent,
  positionDetailsHubHasContent,
  resolvePositionDetailsActionCapabilities,
  resolvePositionDetailsActionModes,
  resolveSelectedPositionDetailsActionMode,
} from "../../../src/features/position-details/model/hub";
import { yieldApiYieldFixture } from "../../fixtures";

describe("position details hub model", () => {
  it("orders the tabs exit, enter, then each pending action type once", () => {
    expect(
      resolvePositionDetailsActionModes({
        canEnter: true,
        canExit: true,
        pendingActionTypes: ["CLAIM_REWARDS", "WITHDRAW", "CLAIM_REWARDS"],
      })
    ).toEqual(["exit", "enter", "CLAIM_REWARDS", "WITHDRAW"]);
    expect(
      resolvePositionDetailsActionModes({
        canEnter: false,
        canExit: false,
        pendingActionTypes: [],
      })
    ).toEqual([]);
  });

  it("opens on the first action the position asks for, else the first tab", () => {
    expect(
      resolveSelectedPositionDetailsActionMode({
        modes: ["exit", "enter", "MERGE", "CLAIM_REWARDS"],
        selectedMode: null,
      })
    ).toBe("CLAIM_REWARDS");
    expect(
      resolveSelectedPositionDetailsActionMode({
        modes: ["exit", "enter", "MERGE"],
        selectedMode: null,
      })
    ).toBe("exit");
    expect(
      resolveSelectedPositionDetailsActionMode({
        modes: [],
        selectedMode: null,
      })
    ).toBe(null);
  });

  it("keeps an explicit tab selection while that action stays offered", () => {
    expect(
      resolveSelectedPositionDetailsActionMode({
        modes: ["exit", "enter", "CLAIM_REWARDS"],
        selectedMode: "enter",
      })
    ).toBe("enter");
    // Once claimed, the Claim tab is gone and the default takes over.
    expect(
      resolveSelectedPositionDetailsActionMode({
        modes: ["exit", "enter"],
        selectedMode: "CLAIM_REWARDS",
      })
    ).toBe("exit");
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
    expect(
      resolvePositionDetailsActionModes({
        ...capabilities,
        pendingActionTypes: [],
      })
    ).toEqual(["enter"]);
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
