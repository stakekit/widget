import { describe, expect, it } from "@effect/vitest";
import { Cause, Context, Effect, Exit, Layer } from "effect";
import type { WalletAddress } from "../../src/domain/identity/identifiers";
import { WalletScopeOwnerKey } from "../../src/domain/wallet/wallet-scope";
import { BorrowOperations } from "../../src/services/api/operations";
import { WidgetDomainEvents } from "../../src/services/events/widget-domain-events";
import { TransactionWorkflowService } from "../../src/services/transaction-workflow/transaction-workflow-service";
import { WalletService } from "../../src/services/wallet/wallet-service";
import type { WalletState } from "../../src/services/wallet/wallet-state";
import { makeDisconnectedWalletState } from "../fixtures/wallet-state";
import { makeTestWallet } from "./services/wallet-service";
import { makeTransactionWorkflowTestKit } from "./transaction-workflow-test-kit";

const disconnectedWalletState: WalletState = makeDisconnectedWalletState();
const owner = new WalletScopeOwnerKey({
  address: "0x0000000000000000000000000000000000000001" as WalletAddress,
  network: "ethereum",
});

describe("makeTransactionWorkflowTestKit", () => {
  it.effect("provides a fresh Workflow layer and adapter controls", () =>
    Effect.gen(function* () {
      const kit = yield* makeTransactionWorkflowTestKit({
        initialWalletState: disconnectedWalletState,
      });
      const context = yield* Layer.build(kit.layer);
      const events = Context.get(context, WidgetDomainEvents);

      expect(Context.get(context, TransactionWorkflowService)).toBeDefined();
      expect(yield* kit.wallet.walletState).toEqual(disconnectedWalletState);

      yield* events.publish({
        _tag: "TransactionWorkflowStarted",
        owner,
      });

      expect(yield* kit.events.publishedEvents).toEqual([
        { _tag: "TransactionWorkflowStarted", owner },
      ]);
    })
  );

  it.effect("uses configured Workflow dependency behavior", () =>
    Effect.gen(function* () {
      const kit = yield* makeTransactionWorkflowTestKit({
        borrow: {
          getAction: () => Effect.succeed(null),
        },
        initialWalletState: disconnectedWalletState,
      });
      const context = yield* Layer.build(kit.layer);

      expect(
        yield* Context.get(context, BorrowOperations).getAction("id")
      ).toBe(null);
    })
  );

  it.effect("dies when an unconfigured Workflow dependency is called", () =>
    Effect.gen(function* () {
      const kit = yield* makeTransactionWorkflowTestKit({
        initialWalletState: disconnectedWalletState,
      });
      const context = yield* Layer.build(kit.layer);
      const exit = yield* Effect.exit(
        Context.get(context, BorrowOperations).getAction("id")
      );

      expect(Exit.isFailure(exit)).toBe(true);
      expect(Exit.isFailure(exit) ? Cause.squash(exit.cause) : null).toBe(
        "makeTransactionWorkflowTestKit: unexpected call to BorrowOperations.getAction"
      );
    })
  );

  it.effect(
    "uses a replacement Wallet service when its runtime is under test",
    () =>
      Effect.gen(function* () {
        const wallet = yield* makeTestWallet({
          initialState: disconnectedWalletState,
        });
        const service = WalletService.of({ ...wallet.service });
        const kit = yield* makeTransactionWorkflowTestKit({
          walletService: service,
        });
        const context = yield* Layer.build(kit.layer);

        expect(Context.get(context, WalletService)).toBe(service);
        expect(kit.wallet.service).toBe(service);
      })
  );
});
