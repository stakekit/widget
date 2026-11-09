import { describe, expect, it } from "vitest";
import { getTransactionErrorReason } from "../../../src/features/activity/model/transaction-error";

describe("Activity transaction error reasons", () => {
  it.each([
    ['execution reverted: "!stake"', "contract_rejected"],
    ["Transaction reverted without a reason", "contract_rejected"],
    ["out of gas", "out_of_gas"],
    ["intrinsic gas too low", "out_of_gas"],
    ["insufficient funds for gas * price + value", "insufficient_funds"],
    ["nonce too low", "nonce"],
    ["replacement transaction underpriced", "nonce"],
    ["User rejected the request.", "cancelled_in_wallet"],
    [
      "MetaMask Tx Signature: User denied transaction signature.",
      "cancelled_in_wallet",
    ],
    // Denials that are not the user declining in the wallet failed.
    ["RPC access denied", "network"],
    ["Transaction rejected by the sequencer", "network"],
    ["Internal JSON-RPC error.", "network"],
    [null, "network"],
  ] as const)("reads %j as %s", (error, reason) => {
    expect(getTransactionErrorReason(error)).toBe(reason);
  });
});
