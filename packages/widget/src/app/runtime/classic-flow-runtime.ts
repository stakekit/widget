import { Effect, Layer } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import {
  ClassicFlowIdentityService,
  ClassicFlowPreviewService,
} from "../../features/transaction-flow/runtime/classic-flow-services";
import type { YieldApiService } from "../../services/api/yield-api-service";
import { appRuntime } from "./app-runtime";

const yieldApiServiceAtom = appRuntime.atom(Effect.context<YieldApiService>());

export const classicFlowRuntime = Atom.runtime((get) => {
  const apiLayer = Layer.unwrap(
    get
      .result(yieldApiServiceAtom)
      .pipe(Effect.map((services) => Layer.succeedContext(services)))
  );
  const previewLayer = ClassicFlowPreviewService.layer.pipe(
    Layer.provide(apiLayer)
  );

  return Layer.mergeAll(ClassicFlowIdentityService.layer, previewLayer).pipe(
    Layer.fresh
  );
});
