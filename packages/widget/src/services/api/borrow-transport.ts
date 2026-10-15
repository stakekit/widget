import { Effect } from "effect";
import { BorrowFeatureDisabled } from "../../domain/borrow/availability";
import { MissingBorrowApiConfig } from "./resource-sources";

export const requireBorrowTransport = <A>(
  borrow: A | null,
  borrowEnabled: boolean
): Effect.Effect<A, BorrowFeatureDisabled | MissingBorrowApiConfig> => {
  if (!borrowEnabled) {
    return Effect.fail(
      new BorrowFeatureDisabled({
        message: "Borrow is disabled by Widget configuration.",
      })
    );
  }

  if (borrow) return Effect.succeed(borrow);

  return Effect.fail(
    new MissingBorrowApiConfig({
      message: "Borrow API URL must be configured before using Borrow.",
    })
  );
};
