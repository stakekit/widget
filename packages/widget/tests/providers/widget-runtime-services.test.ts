import { describe, expect, it, vi } from "@effect/vitest";
import { Cause, Deferred, Effect, Fiber, Layer, Option, Stream } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { applicationRoutes } from "../../src/app/routes/application-routes";
import { appRuntime } from "../../src/app/runtime/app-runtime";
import { applicationBaseRuntime } from "../../src/app/runtime/application-base-runtime";
import { applicationRuntimeInitAtom } from "../../src/app/runtime/application-runtime-init";
import { walletConnectorSourceRuntime } from "../../src/app/runtime/wallet-connector-source-runtime";
import type { SKAppProps } from "../../src/public-api/react-types";
import { BorrowResourceSource } from "../../src/services/api/resource-sources";
import { WidgetConfigService } from "../../src/services/config/widget-config";
import { TrackingService } from "../../src/services/tracking/tracking-service";
import { WalletConnectorSource } from "../../src/services/wallet/wallet-connector-source";

const firstTrackingProbeAtom = appRuntime.atom(
  TrackingService.use((tracking) => Effect.succeed(tracking))
);
const secondTrackingProbeAtom = appRuntime.atom(
  TrackingService.use((tracking) => Effect.succeed(tracking))
);
const borrowIntegrationsProbeAtom = appRuntime.atom(
  BorrowResourceSource.use((borrow) => borrow.getIntegrations())
);
const widgetConfigProbeAtom = appRuntime.atom(
  WidgetConfigService.use((config) => Effect.succeed(config))
);
const walletConnectorSourceProbeAtom = appRuntime.atom(
  WalletConnectorSource.use((source) => Effect.succeed(source))
);
const baseWalletConnectorSourceProbeAtom = applicationBaseRuntime.atom(
  WalletConnectorSource.use((source) => Effect.succeed(source))
);

const makeConfig = (
  trackEvent: (event: string, properties?: object) => void
) => ({
  apiKey: "test-api-key",
  tracking: { trackEvent },
  variant: "default" as const,
});

const runtimeInitialValues = (hostConfiguration: SKAppProps) =>
  [
    [
      applicationRuntimeInitAtom,
      {
        hostConfiguration,
        isLedgerLive: false,
        routes: applicationRoutes,
      },
    ],
  ] as const;

describe("widget runtime service graph", () => {
  it("uses a registry-scoped Wallet Connector Source layer override", () => {
    const walletListFactory = vi.fn(() => []);
    const defaultRegistry = AtomRegistry.make({
      initialValues: runtimeInitialValues(makeConfig(vi.fn())),
    });
    const customRegistry = AtomRegistry.make({
      initialValues: [
        ...runtimeInitialValues(makeConfig(vi.fn())),
        [
          walletConnectorSourceRuntime.layer,
          WalletConnectorSource.layer(walletListFactory),
        ],
      ],
    });

    try {
      expect(
        AsyncResult.getOrThrow(
          defaultRegistry.get(walletConnectorSourceProbeAtom)
        ).walletListFactory
      ).toBeUndefined();
      expect(
        AsyncResult.getOrThrow(
          customRegistry.get(walletConnectorSourceProbeAtom)
        ).walletListFactory
      ).toBe(walletListFactory);
    } finally {
      defaultRegistry.dispose();
      customRegistry.dispose();
    }
  });

  it("shares and finalizes runtime Layers once per registry generation", async () => {
    let initialized = 0;
    let disposed = 0;
    const walletListFactory = vi.fn(() => []);
    const connectorSourceLayer = Layer.effect(
      WalletConnectorSource,
      Effect.acquireRelease(
        Effect.sync(() => {
          initialized += 1;
          return WalletConnectorSource.of({ walletListFactory });
        }),
        () =>
          Effect.sync(() => {
            disposed += 1;
          })
      )
    );
    const makeRegistry = () =>
      AtomRegistry.make({
        initialValues: [
          ...runtimeInitialValues(makeConfig(vi.fn())),
          [walletConnectorSourceRuntime.layer, connectorSourceLayer],
        ],
      });
    const firstRegistry = makeRegistry();
    const baseSource = AsyncResult.getOrThrow(
      firstRegistry.get(baseWalletConnectorSourceProbeAtom)
    );
    const appSource = AsyncResult.getOrThrow(
      firstRegistry.get(walletConnectorSourceProbeAtom)
    );

    expect(appSource).toBe(baseSource);
    expect(initialized).toBe(1);

    firstRegistry.dispose();
    await vi.waitFor(() => expect(disposed).toBe(1));

    const secondRegistry = makeRegistry();
    const remountedSource = AsyncResult.getOrThrow(
      secondRegistry.get(walletConnectorSourceProbeAtom)
    );

    expect(remountedSource).not.toBe(baseSource);
    expect(initialized).toBe(2);

    secondRegistry.dispose();
    await vi.waitFor(() => expect(disposed).toBe(2));
  });

  it.effect(
    "exposes the current widget config and registry-scoped changes",
    () =>
      Effect.gen(function* () {
        const firstTrack = vi.fn();
        const replacementTrack = vi.fn();
        const initialConfig = makeConfig(firstTrack);
        const replacementConfig = makeConfig(replacementTrack);
        const registry = AtomRegistry.make({
          initialValues: runtimeInitialValues(initialConfig),
        });

        try {
          const config = AsyncResult.getOrThrow(
            registry.get(widgetConfigProbeAtom)
          );
          const ready = yield* Deferred.make<void>();
          const changesFiber = yield* Effect.forkChild(
            config.values.pipe(
              Stream.tap(() => Deferred.succeed(ready, undefined)),
              Stream.take(2),
              Stream.runCollect
            )
          );

          yield* Deferred.await(ready);
          expect((yield* config.current).tracking?.trackEvent).toBe(firstTrack);

          yield* config.update(replacementConfig);

          const changes = Array.from(yield* Fiber.join(changesFiber));
          expect(changes.map((value) => value.tracking?.trackEvent)).toEqual([
            firstTrack,
            replacementTrack,
          ]);
          expect((yield* config.current).tracking?.trackEvent).toBe(
            replacementTrack
          );
        } finally {
          registry.dispose();
        }
      })
  );

  it.effect(
    "shares static service layers within a registry and isolates registries",
    () =>
      Effect.gen(function* () {
        const firstTrack = vi.fn();
        const secondTrack = vi.fn();
        const firstRegistry = AtomRegistry.make({
          initialValues: runtimeInitialValues(makeConfig(firstTrack)),
        });
        const secondRegistry = AtomRegistry.make({
          initialValues: runtimeInitialValues(makeConfig(secondTrack)),
        });

        try {
          const firstService = AsyncResult.getOrThrow(
            firstRegistry.get(firstTrackingProbeAtom)
          );
          const sameRegistryService = AsyncResult.getOrThrow(
            firstRegistry.get(secondTrackingProbeAtom)
          );
          const secondService = AsyncResult.getOrThrow(
            secondRegistry.get(firstTrackingProbeAtom)
          );

          expect(sameRegistryService).toBe(firstService);
          expect(secondService).not.toBe(firstService);

          yield* Effect.all([
            firstService.trackEvent("txSigned", { registry: "first" }),
            secondService.trackEvent("txSigned", { registry: "second" }),
          ]);

          expect(firstTrack).toHaveBeenCalledOnce();
          expect(firstTrack).toHaveBeenCalledWith("Transaction signed", {
            registry: "first",
          });
          expect(secondTrack).toHaveBeenCalledOnce();
          expect(secondTrack).toHaveBeenCalledWith("Transaction signed", {
            registry: "second",
          });

          const replacementTrack = vi.fn();
          const firstConfig = AsyncResult.getOrThrow(
            firstRegistry.get(widgetConfigProbeAtom)
          );
          yield* firstConfig.update(makeConfig(replacementTrack));
          yield* firstService.trackEvent("txSigned", {
            registry: "first-updated",
          });

          expect(firstTrack).toHaveBeenCalledOnce();
          expect(replacementTrack).toHaveBeenCalledWith("Transaction signed", {
            registry: "first-updated",
          });
          expect(secondTrack).toHaveBeenCalledOnce();
        } finally {
          firstRegistry.dispose();
          secondRegistry.dispose();
        }
      })
  );

  it("creates fresh lifecycle-sensitive services after a registry remount", () => {
    const config = makeConfig(vi.fn());
    const firstRegistry = AtomRegistry.make({
      initialValues: runtimeInitialValues(config),
    });
    const firstService = AsyncResult.getOrThrow(
      firstRegistry.get(firstTrackingProbeAtom)
    );

    firstRegistry.dispose();

    const remountedRegistry = AtomRegistry.make({
      initialValues: runtimeInitialValues(config),
    });

    try {
      expect(
        AsyncResult.getOrThrow(remountedRegistry.get(firstTrackingProbeAtom))
      ).not.toBe(firstService);
    } finally {
      remountedRegistry.dispose();
    }
  });

  it("keeps the runtime available when a Borrow operation is unavailable", () => {
    const config = {
      apiKey: "test-api-key",
      borrowApiUrl: "",
      borrowEnabled: true,
      dashboardVariant: true,
      tracking: { trackEvent: vi.fn() },
      variant: "default" as const,
    };
    const registry = AtomRegistry.make({
      initialValues: runtimeInitialValues(config),
    });

    try {
      expect(AsyncResult.isSuccess(registry.get(firstTrackingProbeAtom))).toBe(
        true
      );

      const result = registry.get(borrowIntegrationsProbeAtom);
      expect(AsyncResult.isFailure(result)).toBe(true);

      if (AsyncResult.isFailure(result)) {
        const error = Cause.findErrorOption(result.cause);
        expect(Option.isSome(error) && error.value._tag).toBe(
          "MissingBorrowApiConfig"
        );
      }
    } finally {
      registry.dispose();
    }
  });
});
