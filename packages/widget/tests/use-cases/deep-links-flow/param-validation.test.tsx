import { useInitQueryParams } from "@sk-widget/hooks/use-init-query-params";
import { SettingsContextProvider } from "@sk-widget/providers/settings";
import type { ActionTypes } from "@stakekit/api-hooks";
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { setUrl as _setUrl } from "./utils";

describe("Deep link param validation", () => {
  it("Should validate yieldId param", async () => {
    const setAndAssertIsValidYieldIdParam = (
      yieldId: string,
      valid: boolean
    ) => {
      _setUrl({ yieldId });

      expect(
        renderHook(useInitQueryParams, {
          wrapper: ({ children }) => (
            <SettingsContextProvider
              variant="default"
              apiKey={import.meta.env.VITE_API_KEY}
            >
              {children}
            </SettingsContextProvider>
          ),
        })
          .result.current.map((v) => v.yieldId)
          .extract()
      ).toEqual(valid ? yieldId : null);
    };

    setAndAssertIsValidYieldIdParam("ethereum-eth-native-staking", true);
    setAndAssertIsValidYieldIdParam("../ethereum-eth-native-staking", false);
    setAndAssertIsValidYieldIdParam("./ethereum-eth-native-staking", false);
    setAndAssertIsValidYieldIdParam("ethereum-../eth-native-staking", false);
    setAndAssertIsValidYieldIdParam("ethereum-eth-native-staking../", false);
    setAndAssertIsValidYieldIdParam("ethereum-eth-native-staking/../", false);
  });

  it("Should validate pendingAction param", async () => {
    const setAndAssertIsValidPendingActionParam = (
      pendingaction: ActionTypes | (string & {}),
      valid: boolean
    ) => {
      _setUrl({ pendingaction });

      expect(
        renderHook(useInitQueryParams, {
          wrapper: ({ children }) => (
            <SettingsContextProvider
              variant="default"
              apiKey={import.meta.env.VITE_API_KEY}
            >
              {children}
            </SettingsContextProvider>
          ),
        })
          .result.current.map((v) => v.pendingaction)
          .extract()
      ).toEqual(valid ? pendingaction : null);
    };

    setAndAssertIsValidPendingActionParam("CLAIM_REWARDS", true);
    setAndAssertIsValidPendingActionParam("STAKE", true);
    setAndAssertIsValidPendingActionParam("RESTAKE_REWARDS", true);
    setAndAssertIsValidPendingActionParam("../CLAIM_REWARDS", false);
    setAndAssertIsValidPendingActionParam("./CLAIM_REWARDS", false);
    setAndAssertIsValidPendingActionParam("ethereum-../STAKE", false);
    setAndAssertIsValidPendingActionParam("STAKE../", false);
    setAndAssertIsValidPendingActionParam("UNSTAKE/../", false);
  });
});
