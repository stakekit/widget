import { describe, expect, it } from "vitest";
import { decodeInitParams } from "../../../src/domain/schema/init-params";
import type { ActionType } from "../../../src/domain/types/action";
import { setUrl as _setUrl } from "./utils";

const decodeCurrentUrl = () =>
  decodeInitParams({
    externalProviderInitToken: null,
    href: window.location.href,
  });

describe("Deep link param validation", () => {
  it("Should validate yieldId param", async () => {
    const setAndAssertIsValidYieldIdParam = async (
      yieldId: string,
      valid: boolean
    ) => {
      _setUrl({ yieldId });

      expect(decodeCurrentUrl().yieldId).toEqual(valid ? yieldId : null);
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
      pendingaction: ActionType | (string & {}),
      valid: boolean
    ) => {
      _setUrl({ pendingaction });

      expect(decodeCurrentUrl().pendingaction).toEqual(
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

  it("Keeps valid params when another param is invalid", () => {
    const url = new URL(window.location.href);
    url.searchParams.set("network", "not-supported");
    url.searchParams.set("yieldId", "ethereum-eth-native-staking");

    expect(
      decodeInitParams({
        externalProviderInitToken: null,
        href: url.href,
      })
    ).toMatchObject({
      network: null,
      yieldId: "ethereum-eth-native-staking",
    });
  });

  it("Decodes accountId and derives network from the effective token", () => {
    const url = new URL(window.location.href);
    url.searchParams.set("accountId", encodeURIComponent("js:live:eth:0x123"));

    expect(
      decodeInitParams({
        externalProviderInitToken: "ethereum-eth",
        href: url.href,
      })
    ).toMatchObject({
      accountId: "js:live:eth:0x123",
      network: "ethereum",
      token: "ethereum-eth",
    });
  });
});
