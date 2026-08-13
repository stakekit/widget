import { Layer } from "effect";
import { BorrowOperations } from "../../src/services/api/borrow-operations";
import { YieldOperations } from "../../src/services/api/yield-operations";
import { WidgetDomainEvents } from "../../src/services/events/widget-domain-events";
import { TrackingService } from "../../src/services/tracking/tracking-service";
import { TransactionWorkflowService } from "../../src/services/transaction-workflow/transaction-workflow-service";
import { WalletService } from "../../src/services/wallet/wallet-service";

export type TransactionWorkflowTestCapabilities = Readonly<{
  readonly borrow: BorrowOperations["Service"];
  readonly events?: WidgetDomainEvents["Service"];
  readonly tracking: TrackingService["Service"];
  readonly wallet: WalletService["Service"];
  readonly yieldOperations: YieldOperations["Service"];
}>;

export const makeTransactionWorkflowTestLayer = ({
  borrow,
  events,
  tracking,
  wallet,
  yieldOperations,
}: TransactionWorkflowTestCapabilities) =>
  TransactionWorkflowService.layer.pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(BorrowOperations, borrow),
        events
          ? Layer.succeed(WidgetDomainEvents, events)
          : WidgetDomainEvents.layer,
        Layer.succeed(TrackingService, tracking),
        Layer.succeed(WalletService, wallet),
        Layer.succeed(YieldOperations, yieldOperations)
      )
    )
  );
