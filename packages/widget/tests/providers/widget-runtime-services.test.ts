import { Cause, Deferred, Effect, Fiber, Option, Stream } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it, vi } from "vitest";
import { applicationRoutes } from "../../src/app/routes/application-routes";
import { appRuntime } from "../../src/app/runtime/app-runtime";
import { applicationRuntimeInitAtom } from "../../src/app/runtime/application-runtime-init";
import type { SKAppProps } from "../../src/public-api/types";
import { BorrowResourceSource } from "../../src/services/api/resource-sources";
import { WidgetConfigService } from "../../src/services/config/widget-config";
import { TrackingService } from "../../src/services/tracking/tracking-service";

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
  it("exposes the current widget config and registry-scoped changes", async () => {
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
      const ready = await Effect.runPromise(Deferred.make<void>());
      const changesFiber = Effect.runFork(
        config.values.pipe(
          Stream.tap(() => Deferred.succeed(ready, undefined)),
          Stream.take(2),
          Stream.runCollect
        )
      );

      await Effect.runPromise(Deferred.await(ready));
      expect(
        (await Effect.runPromise(config.current)).tracking?.trackEvent
      ).toBe(firstTrack);

      await Effect.runPromise(config.update(replacementConfig));

      const changes = Array.from(
        await Effect.runPromise(Fiber.join(changesFiber))
      );
      expect(changes.map((value) => value.tracking?.trackEvent)).toEqual([
        firstTrack,
        replacementTrack,
      ]);
      expect(
        (await Effect.runPromise(config.current)).tracking?.trackEvent
      ).toBe(replacementTrack);
    } finally {
      registry.dispose();
    }
  });

  it("shares static service layers within a registry and isolates registries", async () => {
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

      await Effect.runPromise(
        Effect.all([
          firstService.trackEvent("txSigned", { registry: "first" }),
          secondService.trackEvent("txSigned", { registry: "second" }),
        ])
      );

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
      await Effect.runPromise(firstConfig.update(makeConfig(replacementTrack)));
      await Effect.runPromise(
        firstService.trackEvent("txSigned", { registry: "first-updated" })
      );

      expect(firstTrack).toHaveBeenCalledOnce();
      expect(replacementTrack).toHaveBeenCalledWith("Transaction signed", {
        registry: "first-updated",
      });
      expect(secondTrack).toHaveBeenCalledOnce();
    } finally {
      firstRegistry.dispose();
      secondRegistry.dispose();
    }
  });

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
