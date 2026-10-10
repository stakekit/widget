import { Effect } from "effect";
import { BorrowFeatureDisabled } from "../../domain/borrow/availability";
import type * as BorrowApi from "../../generated/api/borrow-client";
import { MissingBorrowApiConfig } from "./resource-sources";

export const requireBorrowTransport = (
  borrow: BorrowApi.BorrowApi | null,
  borrowEnabled: boolean
): Effect.Effect<
  BorrowApi.BorrowApi,
  BorrowFeatureDisabled | MissingBorrowApiConfig
> => {
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
