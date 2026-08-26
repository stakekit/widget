import { Layer } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { BorrowTransactionFlowService } from "../../features/borrow-transaction-flow/runtime";
import { ClassicTransactionFlowService } from "../../features/classic-transaction-flow/runtime";
import { YieldEntrySubmissionService } from "../../features/yield-entry/runtime";
import { TransactionWorkflowService } from "../../services/transaction-workflow/transaction-workflow-service";
import { WalletService } from "../../services/wallet/wallet-service";
import { appRuntime } from "./app-runtime";
import { DeepLinkCoordinator } from "./deep-link-coordinator";

export const walletRuntime = Atom.runtime((get) => {
  const appLayer = get(appRuntime.layer);
  const walletLayer = WalletService.defaultLayer.pipe(Layer.provide(appLayer));
  const transactionWorkflowLayer = TransactionWorkflowService.layer.pipe(
    Layer.provide(Layer.merge(appLayer, walletLayer))
  );
  const classicTransactionFlowLayer = ClassicTransactionFlowService.layer.pipe(
    Layer.provide(
      Layer.mergeAll(appLayer, walletLayer, transactionWorkflowLayer)
    )
  );
  const borrowTransactionFlowLayer = BorrowTransactionFlowService.layer.pipe(
    Layer.provide(
      Layer.mergeAll(appLayer, walletLayer, transactionWorkflowLayer)
    )
  );
  const yieldEntrySubmissionLayer = YieldEntrySubmissionService.layer.pipe(
    Layer.provide(Layer.mergeAll(appLayer, walletLayer))
  );
  const deepLinkCoordinatorLayer = DeepLinkCoordinator.layer.pipe(
    Layer.provide(
      Layer.mergeAll(appLayer, walletLayer, classicTransactionFlowLayer)
    )
  );

  return Layer.mergeAll(
    appLayer,
    walletLayer,
    transactionWorkflowLayer,
    borrowTransactionFlowLayer,
    classicTransactionFlowLayer,
    deepLinkCoordinatorLayer,
    yieldEntrySubmissionLayer
  );
});
