import { describe, expect, it, vi } from "vitest";
import {
  claimPendingActionNavigation,
  type PendingActionNavigation,
} from "../../src/app/routes/state/claim-pending-action-navigation";

describe("pending-action deep-link navigation boundary", () => {
  it("pushes a claimed outcome once across repeated effect application", () => {
    let navigation: PendingActionNavigation | null = {
      epoch: 1,
      path: "positions/yield/balance/review",
    };
    const navigate = vi.fn();

    const apply = () => {
      const claim = claimPendingActionNavigation({
        navigation,
        requestedEpoch: 1,
      });
      navigation = claim.navigation;
      if (claim.path) navigate(claim.path);
    };

    apply();
    apply();

    expect(navigation).toBeNull();
    expect(navigate).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith("positions/yield/balance/review");
  });

  it("does not claim a stale epoch", () => {
    const navigation: PendingActionNavigation = {
      epoch: 2,
      path: "positions/yield/balance/review",
    };

    expect(
      claimPendingActionNavigation({
        navigation,
        requestedEpoch: 1,
      })
    ).toEqual({ navigation, path: null });
  });
});
