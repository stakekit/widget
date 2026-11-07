/**
 * Why a transaction did not go through, as a receipt says it in words. A
 * request declined in the wallet is a Cancelled Wallet Request, never a
 * failure.
 */
export type ActivityTransactionErrorReason =
  | "contract_rejected"
  | "insufficient_funds"
  | "network"
  | "nonce"
  | "out_of_gas"
  | "cancelled_in_wallet";

// The first match wins: "insufficient funds for gas" is about funds, not gas.
const ERROR_REASON_PATTERNS: ReadonlyArray<
  readonly [RegExp, ActivityTransactionErrorReason]
> = [
  [/revert/i, "contract_rejected"],
  [/insufficient funds/i, "insufficient_funds"],
  [/nonce|replace/i, "nonce"],
  [/\b(?:rejected|denied)\b/i, "cancelled_in_wallet"],
  [/gas/i, "out_of_gas"],
];

/**
 * Reads a failed transaction's raw error, as the network or the wallet
 * reported it, as one of the reasons a receipt words. An error it does not
 * recognize, or none, failed on the network.
 */
export const getTransactionErrorReason = (
  error: string | null
): ActivityTransactionErrorReason =>
  ERROR_REASON_PATTERNS.find(
    ([pattern]) => error !== null && pattern.test(error)
  )?.[1] ?? "network";
