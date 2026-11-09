import { Effect, Layer } from "effect";
import { BorrowOperations } from "../../../src/services/api/operations";

const unexpectedCall = (method: string): Effect.Effect<never> =>
  Effect.die(new Error(`unexpected call: ${method}`));

/** Borrow API operations the test configures; any other call dies naming it. */
const makeTestBorrowOperations = (
  overrides: Partial<BorrowOperations["Service"]> = {}
): BorrowOperations["Service"] =>
  BorrowOperations.of({
    executeAction: () => unexpectedCall("BorrowOperations.executeAction"),
    getAction: () => unexpectedCall("BorrowOperations.getAction"),
    stepAction: () => unexpectedCall("BorrowOperations.stepAction"),
    submitTransaction: () =>
      unexpectedCall("BorrowOperations.submitTransaction"),
    submitTransactionInBackground: () =>
      unexpectedCall("BorrowOperations.submitTransactionInBackground"),
    ...overrides,
  });

export const borrowOperationsLayer = (
  overrides: Partial<BorrowOperations["Service"]> = {}
) => Layer.succeed(BorrowOperations, makeTestBorrowOperations(overrides));
