import type { Effect } from "effect";
import { describe, expectTypeOf, it } from "vitest";
import type {
  WalletIntegrationError,
  WalletRuntimeInvariantError,
} from "../../../src/services/wallet/wallet-errors";
import type { WalletService } from "../../../src/services/wallet/wallet-service";

describe("wallet service contract", () => {
  it("defines Effect commands without a React dependency", () => {
    expectTypeOf<
      WalletService["Service"]["addLedgerAccount"]
    >().returns.toEqualTypeOf<
      Effect.Effect<
        | Readonly<{ readonly _tag: "Added" }>
        | Readonly<{ readonly _tag: "RejectedStale" }>,
        WalletIntegrationError | WalletRuntimeInvariantError
      >
    >();
  });
});
