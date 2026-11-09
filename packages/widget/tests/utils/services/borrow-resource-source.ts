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
    getAction: () => Effect.fail(missingBorrowApiConfig),
    getPositionData: () => Effect.fail(missingBorrowApiConfig),
    listActions: () => Effect.fail(missingBorrowApiConfig),
  })
);

const unexpectedCall = (method: string): Effect.Effect<never> =>
  Effect.die(new Error(`unexpected call: ${method}`));

/** Borrow API reads the test configures; any other read dies naming it. */
export const borrowResourceSourceLayer = (
  overrides: Partial<BorrowResourceSource["Service"]>
) =>
  Layer.succeed(
    BorrowResourceSource,
    BorrowResourceSource.of({
      getIntegrations: unexpectedCall("BorrowResourceSource.getIntegrations"),
      getMarkets: () => unexpectedCall("BorrowResourceSource.getMarkets"),
      getAction: () => unexpectedCall("BorrowResourceSource.getAction"),
      getPositionData: () =>
        unexpectedCall("BorrowResourceSource.getPositionData"),
      listActions: () => unexpectedCall("BorrowResourceSource.listActions"),
      ...overrides,
    })
  );
