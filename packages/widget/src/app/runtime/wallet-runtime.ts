import { Layer } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { EvmRpc } from "../../services/evm-rpc/evm-rpc";
import { TransactionWorkflowService } from "../../services/transaction-workflow/transaction-workflow-service";
import { WalletChainSelection } from "../../services/wallet/wallet-chain-selection";
import { WalletService } from "../../services/wallet/wallet-service";
import { ZamaService } from "../../services/zama/zama-service";
import { appRuntime } from "./app-runtime";
import { DeepLinkCoordinator } from "./deep-link-coordinator";

export const walletRuntime = Atom.runtime((get) => {
  const appLayer = get(appRuntime.layer);
  const walletLayer = WalletService.defaultLayer.pipe(Layer.provide(appLayer));
  const zamaLayer = ZamaService.layer.pipe(
    Layer.provide(Layer.merge(appLayer, walletLayer))
  );
  const evmRpcLayer = EvmRpc.layer.pipe(Layer.provide(walletLayer));
  const transactionWorkflowLayer = TransactionWorkflowService.layer.pipe(
    Layer.provide(Layer.mergeAll(appLayer, walletLayer, evmRpcLayer, zamaLayer))
  );
  const deepLinkCoordinatorLayer = DeepLinkCoordinator.layer.pipe(
    Layer.provide(Layer.merge(appLayer, walletLayer))
  );
  const walletChainSelectionLayer = WalletChainSelection.layer.pipe(
    Layer.provide(Layer.merge(appLayer, walletLayer))
  );

  return Layer.mergeAll(
    appLayer,
    walletLayer,
    transactionWorkflowLayer,
    walletChainSelectionLayer,
    deepLinkCoordinatorLayer,
    zamaLayer
  );
});
