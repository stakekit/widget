import { describe, expect, it } from "vitest";

import {
  getLeadingPendingAction,
  positionDetailsExitHasContent,
  positionDetailsHubHasContent,
  resolvePositionDetailsActionCapabilities,
  resolvePositionDetailsAmountActions,
  resolvePositionDetailsPageLayout,
} from "../../../src/features/position-details/model/hub";
import { yieldApiYieldFixture } from "../../fixtures";

describe("position details hub model", () => {
  it("orders the amount actions exit first, then entering where offered", () => {
    expect(
      resolvePositionDetailsAmountActions({
        canEnter: true,
        canExit: true,
        offersEnter: true,
      })
    ).toEqual(["exit", "enter"]);
    // The compact Layout has no enter flow.
    expect(
      resolvePositionDetailsAmountActions({
        canEnter: true,
        canExit: true,
        offersEnter: false,
      })
    ).toEqual(["exit"]);
    expect(
      resolvePositionDetailsAmountActions({
        canEnter: false,
        canExit: false,
        offersEnter: true,
      })
    ).toEqual([]);
  });

  it("leads with a required action, else a claim, never an optional one", () => {
    const action = (
      type: "CLAIM_REWARDS" | "MERGE" | "WITHDRAW",
      balanceType: "claimable" | "active" | "withdrawable"
    ) => ({
      pendingAction: { type },
      yieldBalance: { isEncrypted: false, type: balanceType },
    });
    const claim = action("CLAIM_REWARDS", "claimable");
    const withdraw = action("WITHDRAW", "withdrawable");
    const merge = action("MERGE", "active");

    expect(getLeadingPendingAction([claim, withdraw])).toBe(withdraw);
    expect(getLeadingPendingAction([merge, claim])).toBe(claim);
    expect(getLeadingPendingAction([merge])).toBe(null);
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
      resolvePositionDetailsAmountActions({
        ...capabilities,
        offersEnter: true,
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

  it("shows the actions while the position is ready", () => {
    expect(
      resolvePositionDetailsPageLayout({
        flowActive: false,
        page: { _tag: "Ready" },
      })
    ).toBe("Actions");
  });

  it("leaves the details page once the position is gone", () => {
    expect(
      resolvePositionDetailsPageLayout({
        flowActive: false,
        page: { _tag: "PositionLost" },
      })
    ).toBe("PositionLost");
  });

  it("keeps an active flow mounted when its exit removes the position", () => {
    expect(
      resolvePositionDetailsPageLayout({
        flowActive: true,
        page: { _tag: "PositionLost" },
      })
    ).toBe("Actions");
  });

  it("presents a failed first load in place of the actions", () => {
    expect(
      resolvePositionDetailsPageLayout({
        flowActive: false,
        page: { _tag: "Failed" },
      })
    ).toBe("Failed");
  });

  it("keeps an active flow mounted when the position fails to load", () => {
    expect(
      resolvePositionDetailsPageLayout({
        flowActive: true,
        page: { _tag: "Failed" },
      })
    ).toBe("Actions");
  });
});
