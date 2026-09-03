import type { BorrowReviewConfirmationError } from "../state/borrow-review-confirmation-error";

export const borrowReviewConfirmationErrorCopy = {
  descriptionKey: "dashboard.borrow.review_page.confirmation_error_description",
  titleKey: "dashboard.borrow.execution_page.error_title",
} as const;

export const presentBorrowReviewConfirmationError = (
  error: BorrowReviewConfirmationError
): typeof borrowReviewConfirmationErrorCopy => {
  switch (error._tag) {
    case "BorrowReviewConfirmationError":
      return borrowReviewConfirmationErrorCopy;
  }
};
