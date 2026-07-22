import { Cause, Deferred, Effect, Fiber, Option, Stream } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it, vi } from "vitest";
import {
  normalizeWidgetConfig,
  widgetConfigAtom,
} from "../../src/app/config/settings";
import { appRuntime } from "../../src/app/runtime/app-runtime";
import { BorrowResourceSource } from "../../src/services/api/borrow-resource-source";
import {
  type WidgetConfig,
  WidgetConfigService,
} from "../../src/services/config/widget-config";
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

const makeConfig = (trackEvent: (event: string, properties?: object) => void) =>
  normalizeWidgetConfig({
    apiKey: "test-api-key",
    tracking: { trackEvent },
    variant: "default",
  });

const runtimeInitialValues = (config: WidgetConfig) =>
  [[widgetConfigAtom, config]] as const;

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
      expect(config.initial).toBe(initialConfig);
      const ready = await Effect.runPromise(Deferred.make<void>());
      const changesFiber = Effect.runFork(
        config.changes.pipe(
          Stream.tap(() => Deferred.succeed(ready, undefined)),
          Stream.take(2),
          Stream.runCollect
        )
      );

      await Effect.runPromise(Deferred.await(ready));
      expect(await Effect.runPromise(config.current)).toBe(initialConfig);

      registry.set(widgetConfigAtom, replacementConfig);

      const changes = Array.from(
        await Effect.runPromise(Fiber.join(changesFiber))
      );
      expect(changes).toEqual([initialConfig, replacementConfig]);
      expect(await Effect.runPromise(config.current)).toBe(replacementConfig);
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
      firstRegistry.set(widgetConfigAtom, makeConfig(replacementTrack));
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
    const config = normalizeWidgetConfig({
      apiKey: "test-api-key",
      borrowApiUrl: "",
      tracking: { trackEvent: vi.fn() },
      variant: "default",
    });
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
