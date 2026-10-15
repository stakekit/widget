import { Cause, Option } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { describe, expect, it } from "vitest";
import { toBorrowReviewConfirmation } from "../../../src/features/borrow-transaction-flow/state/borrow-review-confirmation-error";

describe("Borrow Review confirmation", () => {
  it("normalizes typed confirmation failures behind the feature boundary", () => {
    const confirmation = toBorrowReviewConfirmation(
      AsyncResult.failure(Cause.fail("internal failure"))
    );

    expect(confirmation.pending).toBe(false);
    expect(
      confirmation.failure.pipe(
        Option.flatMap(Cause.findErrorOption),
        Option.getOrThrow
      )
    ).toEqual(
      expect.objectContaining({
        _tag: "BorrowReviewConfirmationError",
        cause: "internal failure",
      })
    );
  });

  it("is pending without a failure while a retry runs", () => {
    const confirmation = toBorrowReviewConfirmation(
      AsyncResult.failure(Cause.fail("internal failure"), { waiting: true })
    );

    expect(confirmation).toEqual({ failure: Option.none(), pending: true });
  });
});
