type YieldEntrySubmissionFacts = Readonly<{
  readonly connected: boolean;
  readonly externalProviders: boolean;
  readonly isLedgerAccountPlaceholder: boolean;
  readonly isWalletConnecting: boolean;
  readonly kycBlocked: boolean;
  readonly preparationAvailable: boolean;
  readonly validationHasErrors: boolean;
  readonly walletScopeAvailable: boolean;
}>;

type YieldEntrySubmissionDecision =
  | Readonly<{ readonly _tag: "AddLedgerAccount" }>
  | Readonly<{ readonly _tag: "ConnectWallet" }>
  | Readonly<{ readonly _tag: "Invalid" }>
  | Readonly<{ readonly _tag: "KycBlocked" }>
  | Readonly<{ readonly _tag: "StartClassicFlow" }>
  | Readonly<{ readonly _tag: "Unavailable" }>;

export const resolveYieldEntrySubmission = (
  facts: YieldEntrySubmissionFacts
): YieldEntrySubmissionDecision => {
  if (
    !facts.connected &&
    (facts.externalProviders || facts.isWalletConnecting)
  ) {
    return { _tag: "Unavailable" };
  }
  if (facts.connected && facts.isLedgerAccountPlaceholder) {
    return { _tag: "AddLedgerAccount" };
  }
  if (!facts.connected || !facts.walletScopeAvailable) {
    return { _tag: "ConnectWallet" };
  }
  if (facts.validationHasErrors) return { _tag: "Invalid" };
  if (!facts.preparationAvailable) return { _tag: "Unavailable" };
  if (facts.kycBlocked) return { _tag: "KycBlocked" };
  return { _tag: "StartClassicFlow" };
};
