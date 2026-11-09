import { describe, expect, it } from "vitest";

import type { ActionType } from "../../../../src/domain/action/rules";
import { decodeInitParams } from "../../../../src/services/wallet/init-params";

const decodeHref = (href: string) =>
  decodeInitParams({
    externalProviderInitToken: null,
    href,
  });

/** A host URL carrying `params`, encoded as the browser would. */
const hostHref = (params: Readonly<Record<string, string>>) => {
  const url = new URL("https://host.test/");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.href;
};

describe("Deep link param validation", () => {
  it("decodes every supported route-level tab", () => {
    for (const tab of [
      "earn",
      "positions",
      "manage",
      "activity",
      "borrow",
    ] as const) {
      expect(decodeHref(`https://host.test/?tab=${tab}`).tab).toBe(tab);
    }
  });

  it("decodes absent, empty, invalid, and unrelated tabs as null", () => {
    expect(decodeHref("https://host.test/").tab).toBeNull();
    expect(decodeHref("https://host.test/?tab=").tab).toBeNull();
    expect(decodeHref("https://host.test/?tab=stake").tab).toBeNull();
    expect(
      decodeHref("https://host.test/?yieldId=ethereum-eth-native-staking").tab
    ).toBeNull();
  });

  it("Should validate yieldId param", () => {
    const assertYieldIdParam = (yieldId: string, valid: boolean) =>
      expect(decodeHref(hostHref({ yieldId })).yieldId).toEqual(
        valid ? yieldId : null
      );

    assertYieldIdParam("ethereum-eth-native-staking", true);
    assertYieldIdParam("../ethereum-eth-native-staking", false);
    assertYieldIdParam("..", false);
    assertYieldIdParam("..%2f", false);
    assertYieldIdParam("..%252f", false);
    assertYieldIdParam("AAA-%2f..%2f..%2f-whatever", false);
    assertYieldIdParam("./ethereum-eth-native-staking", false);
    assertYieldIdParam("ethereum-../eth-native-staking", false);
    assertYieldIdParam("ethereum-eth-native-staking../", false);
    assertYieldIdParam("ethereum-eth-native-staking/../", false);
  });

  it("Should validate pendingAction param", () => {
    const assertPendingActionParam = (
      pendingaction: ActionType | (string & {}),
      valid: boolean
    ) =>
      expect(decodeHref(hostHref({ pendingaction })).pendingaction).toEqual(
        valid ? pendingaction : null
      );

    assertPendingActionParam("CLAIM_REWARDS", true);
    assertPendingActionParam("STAKE", true);
    assertPendingActionParam("RESTAKE_REWARDS", true);
    assertPendingActionParam("../CLAIM_REWARDS", false);
    assertPendingActionParam("./CLAIM_REWARDS", false);
    assertPendingActionParam("ethereum-../STAKE", false);
    assertPendingActionParam("STAKE../", false);
    assertPendingActionParam("UNSTAKE/../", false);
  });

  it("decodes an unknown pendingaction as null", () => {
    expect(
      decodeHref("https://host.test/?pendingaction=NOT_A_PENDING_ACTION")
        .pendingaction
    ).toBeNull();
  });

  it("Keeps valid params when another param is invalid", () => {
    expect(
      decodeHref(
        hostHref({
          network: "not-supported",
          yieldId: "ethereum-eth-native-staking",
        })
      )
    ).toMatchObject({
      network: null,
      yieldId: "ethereum-eth-native-staking",
    });
  });

  it("Decodes accountId and derives network from the effective token", () => {
    expect(
      decodeInitParams({
        externalProviderInitToken:
          "ethereum-0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        href: hostHref({
          accountId: encodeURIComponent("js:live:eth:0x123"),
        }),
      })
    ).toMatchObject({
      accountId: "js:live:eth:0x123",
      network: "ethereum",
      token: {
        _tag: "HostKey",
        key: "ethereum-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      },
    });
  });

  it("decodes a token without a network prefix as a symbol", () => {
    expect(
      decodeHref("https://host.test/?token=USDa&network=ethereum")
    ).toMatchObject({
      network: "ethereum",
      token: { _tag: "Symbol", symbol: "USDa" },
    });
    // Symbols may contain hyphens; only a network prefix makes a host key.
    expect(
      decodeHref("https://host.test/?token=pcs-v3-weth-usdc")
    ).toMatchObject({
      network: null,
      token: { _tag: "Symbol", symbol: "pcs-v3-weth-usdc" },
    });
  });

  it("decodes a native token key with an empty address", () => {
    expect(decodeHref("https://host.test/?token=ethereum-")).toMatchObject({
      network: "ethereum",
      token: { _tag: "HostKey", key: "ethereum-" },
    });
  });

  it("recognizes a network prefix in any case and keeps hyphens in the address", () => {
    expect(
      decodeHref("https://host.test/?token=ETHEREUM-0xAbCd")
    ).toMatchObject({
      network: "ethereum",
      token: { _tag: "HostKey", key: "ethereum-0xabcd" },
    });
    expect(
      decodeHref("https://host.test/?token=near-foo-bar.near")
    ).toMatchObject({
      network: "near",
      token: { _tag: "HostKey", key: "near-foo-bar.near" },
    });
    expect(
      decodeHref("https://host.test/?token=avalanche-c-0xAbCd")
    ).toMatchObject({
      network: "avalanche-c",
      token: { _tag: "HostKey", key: "avalanche-c-0xabcd" },
    });
  });

  it("decodes position balance keys as balanceId", () => {
    expect(
      decodeHref("https://host.test/?balanceId=validator::abc").balanceId
    ).toBe("validator::abc");
    expect(
      decodeHref("https://host.test/?balanceId=validator%3A%3Aabc%3A12")
        .balanceId
    ).toBe("validator::abc:12");
    expect(decodeHref("https://host.test/?balanceId=default").balanceId).toBe(
      "default"
    );
    expect(
      decodeHref("https://host.test/?balanceId=validators").balanceId
    ).toBe("validators");
  });

  it("rejects balanceId values unsafe for a route segment", () => {
    for (const balanceId of [
      "validator::..",
      "validator::a/b",
      "../positions",
      "validator::a%2Fb",
      "validator::a?b",
      "balance-1",
      "validator::",
      "validator:abc",
    ]) {
      expect(decodeHref(hostHref({ balanceId })).balanceId).toBeNull();
    }
  });
});
