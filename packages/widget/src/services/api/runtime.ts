import { Effect, Layer } from "effect";
import { WidgetConfigService } from "../config/widget-config";
import { RichErrorService } from "../errors/rich-error-service";
import { WalletBootstrapSource } from "../wallet/wallet-bootstrap-source";
import { makeBorrowOperations } from "./borrow-operations";
import { makeBorrowResourceSource } from "./borrow-resource-source";
import { makeLegacyResourceSource } from "./legacy-resource-source";
import { BorrowOperations, YieldOperations } from "./operations";
import {
  BorrowResourceSource,
  LegacyResourceSource,
  YieldResourceSource,
} from "./resource-sources";
import { ApiTransportService } from "./transport";
import { makeYieldOperations } from "./yield-operations";
import { makeYieldResourceSource } from "./yield-resource-source";

const borrowOperationsLayer = Layer.effect(
  BorrowOperations,
  Effect.gen(function* () {
    const transport = yield* ApiTransportService;
    const richErrors = yield* RichErrorService;
    const widgetConfig = yield* WidgetConfigService;

    return makeBorrowOperations(
      transport.borrow,
      (yield* widgetConfig.current).borrowEnabled,
      richErrors
    );
  })
);

const borrowResourceSourceLayer = Layer.effect(
  BorrowResourceSource,
  Effect.gen(function* () {
    const transport = yield* ApiTransportService;
    const widgetConfig = yield* WidgetConfigService;

    return makeBorrowResourceSource(
      transport.borrow,
      (yield* widgetConfig.current).borrowEnabled
    );
  })
);

const legacyResourceSourceLayer = Layer.effect(
  LegacyResourceSource,
  Effect.map(ApiTransportService, (transport) =>
    makeLegacyResourceSource(transport.legacy)
  )
);

const yieldOperationsLayer = Layer.effect(
  YieldOperations,
  Effect.gen(function* () {
    const transport = yield* ApiTransportService;
    const richErrors = yield* RichErrorService;
    return makeYieldOperations(transport.yield, richErrors);
  })
);

const yieldResourceSourceLayer = Layer.effect(
  YieldResourceSource,
  Effect.map(ApiTransportService, (transport) =>
    makeYieldResourceSource(transport.yield)
  )
);

const walletBootstrapSourceLayer = Layer.effect(
  WalletBootstrapSource,
  Effect.gen(function* () {
    const yieldSource = yield* YieldResourceSource;

    return WalletBootstrapSource.of({
      getEnabledWalletNetworks: yieldSource.getEnabledWalletNetworks,
      getOpportunity: yieldSource.getOpportunity,
    });
  })
);

const capabilityLayer = Layer.mergeAll(
  borrowOperationsLayer,
  borrowResourceSourceLayer,
  legacyResourceSourceLayer,
  yieldOperationsLayer,
  yieldResourceSourceLayer
);

export const apiLayer = Layer.merge(
  capabilityLayer,
  walletBootstrapSourceLayer.pipe(Layer.provide(capabilityLayer))
).pipe(Layer.provide(ApiTransportService.layer));
