import { Data, Layer } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { widgetBootstrapConfigAtom } from "../../providers/effect-atom-runtime/bootstrap-config";
import { getWidgetServicesLayer } from "../../providers/effect-atom-runtime/widget-runtime";
import {
  BorrowExecutionEventsService,
  BorrowWalletExecutionService,
} from "./transaction-execution";

export * from "./transaction-execution";

export class MissingBorrowApiClient extends Data.TaggedError(
  "MissingBorrowApiClient"
)<{
  readonly message: string;
}> {}

export const borrowAtomRuntime = Atom.runtime((get) => {
  const widgetServices = getWidgetServicesLayer(get(widgetBootstrapConfigAtom));
  const borrowWalletLayer = BorrowWalletExecutionService.layer.pipe(
    Layer.provide(widgetServices)
  );
  const borrowServices = Layer.mergeAll(widgetServices, borrowWalletLayer);

  return Layer.mergeAll(
    borrowServices,
    BorrowExecutionEventsService.layer
  ).pipe(Layer.fresh);
});
