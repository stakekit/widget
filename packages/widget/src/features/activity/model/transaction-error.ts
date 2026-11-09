import { isWalletRejection } from "../../../services/wallet/wallet-cancellation";

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

const matches =
  (pattern: RegExp) =>
  (error: string): boolean =>
    pattern.test(error);

// The first match wins: "insufficient funds for gas" is about funds, not gas.
// Only a message the wallet uses for the user declining reads as cancelled,
// the same way the wallet service tells one: "RPC access denied" failed.
const ERROR_REASON_MATCHERS: ReadonlyArray<
  readonly [(error: string) => boolean, ActivityTransactionErrorReason]
> = [
  [matches(/revert/i), "contract_rejected"],
  [matches(/insufficient funds/i), "insufficient_funds"],
  [matches(/nonce|replace/i), "nonce"],
  [(error) => isWalletRejection({ message: error }), "cancelled_in_wallet"],
  [matches(/gas/i), "out_of_gas"],
];

/**
 * Reads a failed transaction's raw error, as the network or the wallet
 * reported it, as one of the reasons a receipt words. An error it does not
 * recognize, or none, failed on the network.
 */
export const getTransactionErrorReason = (
  error: string | null
): ActivityTransactionErrorReason =>
  ERROR_REASON_MATCHERS.find(
    ([match]) => error !== null && match(error)
  )?.[1] ?? "network";
