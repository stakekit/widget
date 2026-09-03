import { describe, expect, it } from "vitest";
import { resolveYieldEntrySubmission } from "../../src/features/yield-entry/model/yield-entry-submission";

const eligibleSubmission = {
  connected: true,
  externalProviders: false,
  isLedgerAccountPlaceholder: false,
  isWalletConnecting: false,
  kycBlocked: false,
  preparationAvailable: true,
  validationHasErrors: false,
  walletScopeAvailable: true,
} as const;

describe("Yield Entry submission", () => {
  it.each([
    {
      expected: "Unavailable",
      input: {
        ...eligibleSubmission,
        connected: false,
        externalProviders: true,
        walletScopeAvailable: false,
      },
      name: "external provider owns connection",
    },
    {
      expected: "Unavailable",
      input: {
        ...eligibleSubmission,
        connected: false,
        isWalletConnecting: true,
        walletScopeAvailable: false,
      },
      name: "wallet connection is already in progress",
    },
    {
      expected: "AddLedgerAccount",
      input: {
        ...eligibleSubmission,
        isLedgerAccountPlaceholder: true,
      },
      name: "connected Ledger placeholder",
    },
    {
      expected: "ConnectWallet",
      input: {
        ...eligibleSubmission,
        connected: false,
        walletScopeAvailable: false,
      },
      name: "disconnected wallet",
    },
    {
      expected: "Invalid",
      input: { ...eligibleSubmission, validationHasErrors: true },
      name: "invalid entry",
    },
    {
      expected: "Unavailable",
      input: { ...eligibleSubmission, preparationAvailable: false },
      name: "missing preparation",
    },
    {
      expected: "KycBlocked",
      input: { ...eligibleSubmission, kycBlocked: true },
      name: "KYC block",
    },
    {
      expected: "StartClassicFlow",
      input: eligibleSubmission,
      name: "eligible entry",
    },
  ])("resolves $name", ({ expected, input }) => {
    expect(resolveYieldEntrySubmission(input)._tag).toBe(expected);
  });

  it("keeps validation ahead of preparation and KYC rejection", () => {
    expect(
      resolveYieldEntrySubmission({
        ...eligibleSubmission,
        kycBlocked: true,
        preparationAvailable: false,
        validationHasErrors: true,
      })
    ).toEqual({ _tag: "Invalid" });
  });
});
