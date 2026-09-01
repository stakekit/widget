import { Effect, Layer, PubSub, Ref, Stream } from "effect";
import {
  BorrowOperations,
  YieldOperations,
} from "../../src/services/api/operations";
import {
  type WidgetDomainEvent,
  WidgetDomainEvents,
} from "../../src/services/events/widget-domain-events";
import { TransactionWorkflowService } from "../../src/services/transaction-workflow/transaction-workflow-service";
import { WalletService } from "../../src/services/wallet/wallet-service";
import type { WalletState } from "../../src/services/wallet/wallet-state";
import { makeTestTracking } from "./services/tracking-service";
import {
  makeTestWallet,
  type TestWalletBehaviorOptions,
} from "./services/wallet-service";

type TransactionWorkflowTestKitBehavior = Readonly<{
  readonly borrow?: Partial<BorrowOperations["Service"]>;
  readonly yieldOperations?: Partial<YieldOperations["Service"]>;
}>;

export type TransactionWorkflowTestKitOptions =
  TransactionWorkflowTestKitBehavior &
    (
      | Readonly<{
          readonly initialWalletState: WalletState;
          readonly wallet?: TestWalletBehaviorOptions;
          readonly walletService?: never;
        }>
      | Readonly<{
          readonly initialWalletState?: never;
          readonly wallet?: never;
          readonly walletService: WalletService["Service"];
        }>
    );

const unexpectedWorkflowCall = <A>(method: string): Effect.Effect<A> =>
  Effect.die(`makeTransactionWorkflowTestKit: unexpected call to ${method}`);

const makeTestDomainEvents = Effect.fn("makeTestDomainEvents")(function* () {
  const publishedEvents = yield* Ref.make<ReadonlyArray<WidgetDomainEvent>>([]);
  const pubsub = yield* PubSub.unbounded<WidgetDomainEvent>();
  yield* Effect.addFinalizer(() => PubSub.shutdown(pubsub));
  const service = WidgetDomainEvents.of({
    events: Stream.fromPubSub(pubsub),
    publish: (event) =>
      Ref.update(publishedEvents, (current) => [...current, event]).pipe(
        Effect.andThen(PubSub.publish(pubsub, event)),
        Effect.asVoid
      ),
  });

  return {
    layer: Layer.succeed(WidgetDomainEvents, service),
    publishedEvents: Ref.get(publishedEvents),
    service,
  } as const;
});

export const makeTransactionWorkflowTestKit = Effect.fn(
  "makeTransactionWorkflowTestKit"
)(function* (options: TransactionWorkflowTestKitOptions) {
  const events = yield* makeTestDomainEvents();
  const tracking = yield* makeTestTracking();
  const wallet = yield* Effect.gen(function* () {
    if (options.walletService) {
      return {
        layer: Layer.succeed(WalletService, options.walletService),
        service: options.walletService,
        walletState: options.walletService.state,
      } as const;
    }
    return yield* makeTestWallet({
      ...options.wallet,
      initialState: options.initialWalletState,
    });
  });
  const dependencies = Layer.mergeAll(
    Layer.succeed(
      BorrowOperations,
      BorrowOperations.of({
        executeAction: () =>
          unexpectedWorkflowCall("BorrowOperations.executeAction"),
        getAction: () => unexpectedWorkflowCall("BorrowOperations.getAction"),
        stepAction: () => unexpectedWorkflowCall("BorrowOperations.stepAction"),
        submitTransaction: () =>
          unexpectedWorkflowCall("BorrowOperations.submitTransaction"),
        ...options.borrow,
      })
    ),
    events.layer,
    tracking.layer,
    wallet.layer,
    Layer.succeed(
      YieldOperations,
      YieldOperations.of({
        getTransactionStatus: () =>
          unexpectedWorkflowCall("YieldOperations.getTransactionStatus"),
        previewAction: () =>
          unexpectedWorkflowCall("YieldOperations.previewAction"),
        submitSignedTransaction: () =>
          unexpectedWorkflowCall("YieldOperations.submitSignedTransaction"),
        submitTransactionHash: () =>
          unexpectedWorkflowCall("YieldOperations.submitTransactionHash"),
        ...options.yieldOperations,
      })
    )
  );

  return {
    events,
    layer: Layer.merge(
      dependencies,
      TransactionWorkflowService.layer.pipe(Layer.provide(dependencies))
    ),
    tracking,
    wallet,
  } as const;
});
