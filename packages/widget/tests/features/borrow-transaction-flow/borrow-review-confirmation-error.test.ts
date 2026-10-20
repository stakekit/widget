import { Cause, Option } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { describe, expect, it } from "vitest";
import {
  BorrowReviewConfirmationFailure,
  toBorrowReviewConfirmation,
} from "../../../src/features/borrow-transaction-flow/state/review-page";

const rejected = BorrowReviewConfirmationFailure.cases.Rejected.make({
  reason: "Insufficient WETH.",
});
const failed = BorrowReviewConfirmationFailure.cases.Failed.make({});

describe("Borrow Review confirmation", () => {
  it.each([
    ["an API refusal keeps its reason", Cause.fail(rejected), rejected],
    [
      "a runtime error is a generic failure",
      Cause.fail({ _tag: "WalletRuntimeInvariantError" }),
      failed,
    ],
    ["a defect is a generic failure", Cause.die(new Error("boom")), failed],
  ] as const)("%s", (_, cause, failure) => {
    expect(toBorrowReviewConfirmation(AsyncResult.failure(cause))).toEqual({
      failure: Option.some(failure),
      pending: false,
    });
  });

  it("is pending without a failure while a retry runs", () => {
    const confirmation = toBorrowReviewConfirmation(
      AsyncResult.failure(Cause.fail(rejected), { waiting: true })
    );

    expect(confirmation).toEqual({ failure: Option.none(), pending: true });
  });
});
