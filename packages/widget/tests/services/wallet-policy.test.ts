import { describe, expect, it } from "vitest";
import {
  applyWalletPolicy,
  type WalletPolicy,
} from "../../src/domain/wallet/wallet-policy";

type TestWallet = Readonly<{
  id: string;
}>;

const wallet = (id: string): TestWallet => ({ id });

describe("Wallet Policy", () => {
  it("filters, regroups, and partially orders available wallets", () => {
    const available = [
      {
        groupName: "Popular",
        wallets: [wallet("alpha"), wallet("beta"), wallet("gamma")],
      },
      {
        groupName: "Other",
        wallets: [wallet("delta"), wallet("epsilon")],
      },
      {
        groupName: "Secondary",
        wallets: [wallet("zeta")],
      },
    ];
    const policy = {
      allow: ["epsilon", "gamma", "beta", "delta", "zeta", "missing"],
      deny: ["delta"],
      order: ["epsilon", "beta"],
      groups: { epsilon: "Preferred" },
      groupOrder: ["Preferred"],
    } satisfies WalletPolicy;

    expect(applyWalletPolicy(available, policy)).toStrictEqual([
      {
        groupName: "Preferred",
        wallets: [wallet("epsilon")],
      },
      {
        groupName: "Popular",
        wallets: [wallet("beta"), wallet("gamma")],
      },
      {
        groupName: "Secondary",
        wallets: [wallet("zeta")],
      },
    ]);
  });

  it("uses the first repeated ordering entry and keeps unlisted entries stable", () => {
    const available = [
      {
        groupName: "Available",
        wallets: [wallet("alpha"), wallet("beta"), wallet("gamma")],
      },
      {
        groupName: "Empty after policy",
        wallets: [wallet("denied")],
      },
    ];

    expect(
      applyWalletPolicy(available, {
        deny: ["denied", "unavailable"],
        order: ["beta", "alpha", "beta"],
        groupOrder: ["Available", "Available"],
      })
    ).toStrictEqual([
      {
        groupName: "Available",
        wallets: [wallet("beta"), wallet("alpha"), wallet("gamma")],
      },
    ]);
  });
});
