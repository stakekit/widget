import { Schema } from "effect";
import { encodeFunctionData, erc20Abi } from "viem";
import type { Network } from "../network/network";
import type { EvmChainIds } from "../wallet/chain-ids";

type Address = `0x${string}`;

/** Names a Direct Transaction for one Flow Session; no API knows it. */
export const DirectTransactionId = Schema.NonEmptyString.pipe(
  Schema.brand("DirectTransactionId")
);
export type DirectTransactionId = typeof DirectTransactionId.Type;

/** An ERC-20 allowance an approval sets: `owner` lets `spender` move `amount` of `token`. */
export type Erc20Approval = Readonly<{
  readonly amount: bigint;
  readonly owner: Address;
  readonly spender: Address;
  readonly token: Address;
}>;

/**
 * A transaction the widget builds itself, so no API records it: it is signed,
 * broadcast, and confirmed by its receipt.
 */
export type DirectTransaction = Readonly<{
  /**
   * The allowance an approval or its reset serves. It is read again before
   * signing, since an approval may have landed after it was planned.
   */
  readonly approval: Erc20Approval | null;
  readonly chainId: EvmChainIds;
  readonly data: Address;
  /** Stable for one Flow Session, so a retry finds it again. */
  readonly id: DirectTransactionId;
  readonly network: Network;
  readonly to: Address;
  readonly type: "APPROVAL" | "RESET_APPROVAL" | "WRAP";
}>;

/**
 * Approves `amount`, or, as a reset, zero: tokens such as USDT revert when one
 * non-zero allowance changes to another. `id` names the approval; its reset is
 * named after it, so a reset planned upfront and one added before signing are
 * the same transaction to the Ledger.
 */
export const makeErc20Approval = ({
  chainId,
  id,
  network,
  type,
  ...approval
}: Erc20Approval & {
  readonly chainId: EvmChainIds;
  readonly id: DirectTransactionId;
  readonly network: Network;
  readonly type: "APPROVAL" | "RESET_APPROVAL";
}): DirectTransaction => ({
  approval,
  chainId,
  data: encodeFunctionData({
    abi: erc20Abi,
    args: [approval.spender, type === "APPROVAL" ? approval.amount : 0n],
    functionName: "approve",
  }),
  id: type === "APPROVAL" ? id : DirectTransactionId.make(`${id}-reset`),
  network,
  to: approval.token,
  type,
});

/**
 * What an approval needs once `allowance` is read before signing: nothing when
 * it already covers the amount, a reset first when a short one remains.
 */
export const decideErc20Approval = (
  transaction: DirectTransaction & { readonly approval: Erc20Approval },
  allowance: bigint
): "ResetFirst" | "Sign" | "Skip" => {
  if (allowance >= transaction.approval.amount) return "Skip";
  if (transaction.type === "RESET_APPROVAL") {
    return allowance === 0n ? "Skip" : "Sign";
  }
  return allowance === 0n ? "Sign" : "ResetFirst";
};
