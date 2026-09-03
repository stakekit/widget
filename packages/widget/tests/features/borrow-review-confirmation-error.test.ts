import { Cause } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { describe, expect, it } from "vitest";
import {
  BorrowReviewConfirmationError,
  normalizeBorrowReviewConfirmationResult,
} from "../../src/features/borrow-transaction-flow/state/borrow-review-confirmation-error";
import { presentBorrowReviewConfirmationError } from "../../src/features/borrow-transaction-flow/ui/borrow-review-confirmation-error";

describe("Borrow Review confirmation error presentation", () => {
  it("maps the feature-owned error to safe localized copy", () => {
    const error = new BorrowReviewConfirmationError({
      cause: "internal detail",
    });

    expect(presentBorrowReviewConfirmationError(error)).toEqual({
      descriptionKey:
        "dashboard.borrow.review_page.confirmation_error_description",
      titleKey: "dashboard.borrow.execution_page.error_title",
    });
  });

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
