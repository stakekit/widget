import { getAndValidateInitParams } from "@sk-widget/hooks/use-init-params";
import type { ActionTypes } from "@stakekit/api-hooks";
import { describe, expect, it } from "vitest";
import { setUrl as _setUrl } from "./utils";

describe("Deep link param validation", () => {
  it("Should validate yieldId param", async () => {
    let yieldId = "ethereum-eth-native-staking";
    const assertIsValidPendingAction = (hasRes: boolean) =>
      expect(
        getAndValidateInitParams({ externalProviderInitToken: undefined })
          .map((v) => v.yieldId)
          .extract()
      ).toEqual(hasRes ? yieldId : null);

    const setYieldIdParam = (newYieldId: string) => {
      yieldId = newYieldId;
      _setUrl({ yieldId });
    };

    setYieldIdParam(yieldId);
    assertIsValidPendingAction(true);

    setYieldIdParam("../ethereum-eth-native-staking");
    assertIsValidPendingAction(false);

    setYieldIdParam("./ethereum-eth-native-staking");
    assertIsValidPendingAction(false);

    setYieldIdParam("ethereum-../eth-native-staking");
    assertIsValidPendingAction(false);

    setYieldIdParam("ethereum-eth-native-staking../");
    assertIsValidPendingAction(false);

    setYieldIdParam("ethereum-eth-native-staking/../");
    assertIsValidPendingAction(false);
  });

  it("Should validate pendingAction param", async () => {
    let pendingaction: ActionTypes | (string & {}) = "";
    const assertIsValidPendingAction = (hasRes: boolean) =>
      expect(
        getAndValidateInitParams({ externalProviderInitToken: undefined })
          .map((v) => v.pendingaction)
          .extract()
      ).toEqual(hasRes ? pendingaction : null);

    const setPendingActionParam = (
      newPendingActionParam: typeof pendingaction
    ) => {
      pendingaction = newPendingActionParam;
      _setUrl({ pendingaction });
    };

    setPendingActionParam("CLAIM_REWARDS");
    assertIsValidPendingAction(true);

    setPendingActionParam("STAKE");
    assertIsValidPendingAction(true);

    setPendingActionParam("RESTAKE_REWARDS");
    assertIsValidPendingAction(true);

    setPendingActionParam("../CLAIM_REWARDS");
    assertIsValidPendingAction(false);

    setPendingActionParam("./CLAIM_REWARDS");
    assertIsValidPendingAction(false);

    setPendingActionParam("ethereum-../STAKE");
    assertIsValidPendingAction(false);

    setPendingActionParam("STAKE../");
    assertIsValidPendingAction(false);

    setPendingActionParam("UNSTAKE/../");
    assertIsValidPendingAction(false);
  });
});
