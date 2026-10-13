import { Effect, Layer } from "effect";
import {
  BorrowResourceSource,
  MissingBorrowApiConfig,
} from "../../../src/services/api/resource-sources";

const missingBorrowApiConfig = new MissingBorrowApiConfig({
  message: "Borrow API URL must be configured before using Borrow.",
});

/** Borrow without an API URL: every read fails as it does in production. */
export const unconfiguredBorrowResourceSourceLayer = Layer.succeed(
  BorrowResourceSource,
  BorrowResourceSource.of({
    getIntegrations: Effect.fail(missingBorrowApiConfig),
    getMarkets: () => Effect.fail(missingBorrowApiConfig),
    getPositionData: () => Effect.fail(missingBorrowApiConfig),
    listActions: () => Effect.fail(missingBorrowApiConfig),
  })
);
