import { Cause } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { describe, expect, it } from "vitest";
import { normalizeBorrowReviewConfirmationResult } from "../../src/features/borrow-transaction-flow/state/borrow-review-confirmation-error";

describe("Borrow Review confirmation error presentation", () => {
  it("normalizes typed confirmation failures behind the feature boundary", () => {
    const result = normalizeBorrowReviewConfirmationResult(
      AsyncResult.failure(Cause.fail("internal failure"))
    );

    expect(AsyncResult.isFailure(result)).toBe(true);
    if (AsyncResult.isFailure(result)) {
      expect(Cause.findError(result.cause)).toEqual(
        expect.objectContaining({
          success: expect.objectContaining({
            _tag: "BorrowReviewConfirmationError",
          }),
        })
      );
    }
  });
});
