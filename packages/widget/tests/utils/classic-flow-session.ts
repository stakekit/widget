import type { ClassicTransactionFlowIntake } from "../../src/features/classic-transaction-flow/model/classic-transaction-flow";
import { makeClassicTransactionFlowDestination } from "../../src/features/classic-transaction-flow/state";

export const makeStartClassicFlowSession = (
  intake: ClassicTransactionFlowIntake
) => ({
  destination: makeClassicTransactionFlowDestination({ routeBase: "" }),
  intake,
});
