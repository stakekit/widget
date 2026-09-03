import { describe, expect, it } from "vitest";
import {
  applyBorrowRepayFormAction,
  applyBorrowWithdrawFormAction,
  makeDefaultBorrowRepayFormIntent,
  makeDefaultBorrowWithdrawFormIntent,
} from "../../../src/features/borrow/market-position/model/action-form";

describe("Borrow position action form intent", () => {
  it("normalizes and resets repayment intent", () => {
    const changed = applyBorrowRepayFormAction({
      action: { amount: "100.500", type: "amount/set" },
      intent: makeDefaultBorrowRepayFormIntent(),
    });
    const repayAll = applyBorrowRepayFormAction({
      action: { repayAll: true, type: "repayAll/set" },
      intent: changed,
    });

    expect(repayAll).toEqual({ amount: "100.5", repayAll: true });
    expect(
      applyBorrowRepayFormAction({
        action: { type: "reset" },
        intent: repayAll,
      })
    ).toEqual(makeDefaultBorrowRepayFormIntent());
  });

  it("clears a withdrawal amount when the selected token changes", () => {
    const changed = applyBorrowWithdrawFormAction({
      action: { amount: "0.25", type: "amount/set" },
      intent: makeDefaultBorrowWithdrawFormIntent(),
    });

    expect(
      applyBorrowWithdrawFormAction({
        action: {
          tokenAddress: "0x0000000000000000000000000000000000000001",
          type: "token/select",
        },
        intent: changed,
      })
    ).toEqual({
      amount: "0",
      selectedTokenAddress: "0x0000000000000000000000000000000000000001",
    });
  });
});
