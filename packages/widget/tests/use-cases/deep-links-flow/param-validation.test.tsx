import type { ActionTypes } from "@stakekit/api-hooks";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it } from "vitest";
import { useInitQueryParams } from "../../../src/hooks/use-init-query-params";
import { SettingsContextProvider } from "../../../src/providers/settings";
import { i18nInstance } from "../../../src/translation";
import { renderHook } from "../../utils/test-utils";
import { setUrl as _setUrl } from "./utils";

describe("Deep link param validation", () => {
  it("Should validate yieldId param", async () => {
    const setAndAssertIsValidYieldIdParam = async (
      yieldId: string,
      valid: boolean
    ) => {
      _setUrl({ yieldId });

      const result = await renderHook(useInitQueryParams, {
        wrapper: ({ children }) => (
          <SettingsContextProvider
            variant="default"
            apiKey={import.meta.env.VITE_API_KEY}
          >
            <I18nextProvider i18n={i18nInstance}>{children}</I18nextProvider>
          </SettingsContextProvider>
        ),
      });

      expect(result.result.current.map((v) => v.yieldId).extract()).toEqual(
        valid ? yieldId : null
      );
    };

    await setAndAssertIsValidYieldIdParam("ethereum-eth-native-staking", true);
    await setAndAssertIsValidYieldIdParam(
      "../ethereum-eth-native-staking",
      false
    );
    await setAndAssertIsValidYieldIdParam("..", false);
    await setAndAssertIsValidYieldIdParam("..%2f", false);
    await setAndAssertIsValidYieldIdParam("..%252f", false);
    await setAndAssertIsValidYieldIdParam("AAA-%2f..%2f..%2f-whatever", false);
    await setAndAssertIsValidYieldIdParam(
      "./ethereum-eth-native-staking",
      false
    );
    await setAndAssertIsValidYieldIdParam(
      "ethereum-../eth-native-staking",
      false
    );
    await setAndAssertIsValidYieldIdParam(
      "ethereum-eth-native-staking../",
      false
    );
    await setAndAssertIsValidYieldIdParam(
      "ethereum-eth-native-staking/../",
      false
    );
  });

  it("Should validate pendingAction param", async () => {
    const setAndAssertIsValidPendingActionParam = async (
      pendingaction: ActionTypes | (string & {}),
      valid: boolean
    ) => {
      _setUrl({ pendingaction });

      const { result } = await renderHook(useInitQueryParams, {
        wrapper: ({ children }) => (
          <SettingsContextProvider
            variant="default"
            apiKey={import.meta.env.VITE_API_KEY}
          >
            <I18nextProvider i18n={i18nInstance}>{children}</I18nextProvider>
          </SettingsContextProvider>
        ),
      });

      expect(result.current.map((v) => v.pendingaction).extract()).toEqual(
        valid ? pendingaction : null
      );
    };

    await setAndAssertIsValidPendingActionParam("CLAIM_REWARDS", true);
    await setAndAssertIsValidPendingActionParam("STAKE", true);
    await setAndAssertIsValidPendingActionParam("RESTAKE_REWARDS", true);
    await setAndAssertIsValidPendingActionParam("../CLAIM_REWARDS", false);
    await setAndAssertIsValidPendingActionParam("./CLAIM_REWARDS", false);
    await setAndAssertIsValidPendingActionParam("ethereum-../STAKE", false);
    await setAndAssertIsValidPendingActionParam("STAKE../", false);
    await setAndAssertIsValidPendingActionParam("UNSTAKE/../", false);
  });
});
