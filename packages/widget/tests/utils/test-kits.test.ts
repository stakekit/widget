import { describe, expect, it } from "@effect/vitest";
import { Cause, Context, Effect, Exit, Layer, Schema } from "effect";

import { ActionId as BorrowActionId } from "../../src/domain/borrow/ids";
import {
  BorrowOperations,
  YieldOperations,
} from "../../src/services/api/operations";
import type { WalletState } from "../../src/services/wallet/wallet-state";
import { makeDisconnectedWalletState } from "../fixtures/wallet-state";
import { makeTestWallet } from "./services/wallet-service";
import { makeTransactionWorkflowTestKit } from "./transaction-workflow-test-kit";
import { makeYieldFlowTestKit } from "./yield-flow-test-kit";

const disconnectedWalletState: WalletState = makeDisconnectedWalletState();
const borrowActionId = Schema.decodeSync(BorrowActionId)("id");

const expectDies = <A, E>(exit: Exit.Exit<A, E>) =>
  expect(Exit.isFailure(exit) && Cause.hasDies(exit.cause)).toBe(true);

/**
 * A dependency a test did not configure fails loudly rather than returning a
 * plausible default, so a test never passes on behavior it did not set up.
 */
describe("test kits", () => {
  it.effect("the test wallet dies for an unconfigured command", () =>
    Effect.gen(function* () {
      const wallet = yield* makeTestWallet({
        initialState: disconnectedWalletState,
      });

      expectDies(yield* Effect.exit(wallet.service.logout));
    })
  );

  it.effect("the Yield Flow kit dies for an unconfigured dependency", () =>
    Effect.gen(function* () {
      const kit = yield* makeYieldFlowTestKit({
        initialWalletState: disconnectedWalletState,
      });
      const context = yield* Layer.build(kit.layer);

      expectDies(
        yield* Effect.exit(
          Context.get(context, YieldOperations).previewAction({} as never)
        )
      );
    })
  );

  it.effect("the Workflow kit dies for an unconfigured dependency", () =>
    Effect.gen(function* () {
      const kit = yield* makeTransactionWorkflowTestKit({
        initialWalletState: disconnectedWalletState,
      });
      const context = yield* Layer.build(kit.layer);

      expectDies(
        yield* Effect.exit(
          Context.get(context, BorrowOperations).getAction(borrowActionId)
        )
      );
    })
  );
});
