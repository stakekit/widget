import { Effect, Layer } from "effect";
import { WidgetConfigService } from "../config/widget-config";
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

export type ApiServices =
  | BorrowOperations
  | BorrowResourceSource
  | LegacyResourceSource
  | YieldOperations
  | YieldResourceSource;

const borrowOperationsLayer = Layer.effect(
  BorrowOperations,
  Effect.gen(function* () {
    const { operations } = yield* ApiTransportService;
    const widgetConfig = yield* WidgetConfigService;

    return makeBorrowOperations(
      operations.borrow,
      (yield* widgetConfig.current).borrowEnabled
    );
  })
);

const borrowResourceSourceLayer = Layer.effect(
  BorrowResourceSource,
  Effect.gen(function* () {
    const { resources } = yield* ApiTransportService;
    const widgetConfig = yield* WidgetConfigService;

    return makeBorrowResourceSource(
      resources.borrow,
      (yield* widgetConfig.current).borrowEnabled
    );
  })
);

const legacyResourceSourceLayer = Layer.effect(
  LegacyResourceSource,
  Effect.map(ApiTransportService, ({ resources }) =>
    makeLegacyResourceSource(resources.legacy)
  )
);

const yieldOperationsLayer = Layer.effect(
  YieldOperations,
  Effect.map(ApiTransportService, ({ operations }) =>
    makeYieldOperations(operations.yield)
  )
);

const yieldResourceSourceLayer = Layer.effect(
  YieldResourceSource,
  Effect.map(ApiTransportService, ({ resources }) =>
    makeYieldResourceSource(resources.yield)
  )
);

const walletBootstrapSourceLayer = Layer.effect(
  WalletBootstrapSource,
  Effect.gen(function* () {
    const legacySource = yield* LegacyResourceSource;
    const yieldSource = yield* YieldResourceSource;

    return WalletBootstrapSource.of({
      getEnabledNetworks: legacySource.getEnabledNetworks,
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
