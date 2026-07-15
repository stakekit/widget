import { Cause, Effect, Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it, vi } from "vitest";
import { widgetBootstrapConfigAtom } from "../../src/app/config";
import { appRuntime } from "../../src/app/runtime";
import { BorrowApiService } from "../../src/services/api/borrow-api-service";
import {
  defaultWidgetBootstrapConfig,
  type WidgetBootstrapConfigValue,
} from "../../src/services/config/widget-config";
import { TrackingService } from "../../src/services/tracking/tracking-service";

const firstTrackingProbeAtom = appRuntime.atom(
  TrackingService.use((tracking) => Effect.succeed(tracking))
);
const secondTrackingProbeAtom = appRuntime.atom(
  TrackingService.use((tracking) => Effect.succeed(tracking))
);
const borrowIntegrationsProbeAtom = appRuntime.atom(
  BorrowApiService.use((borrow) => borrow.getIntegrations())
);

const makeConfig = (
  trackEvent: (event: string, properties?: object) => void
): WidgetBootstrapConfigValue => ({
  ...defaultWidgetBootstrapConfig,
  tracking: {
    tracking: { trackEvent },
    variant: "default",
  },
});

describe("widget runtime service graph", () => {
  it("shares static service layers within a registry and isolates registries", async () => {
    const firstTrack = vi.fn();
    const secondTrack = vi.fn();
    const firstRegistry = AtomRegistry.make({
      initialValues: [[widgetBootstrapConfigAtom, makeConfig(firstTrack)]],
    });
    const secondRegistry = AtomRegistry.make({
      initialValues: [[widgetBootstrapConfigAtom, makeConfig(secondTrack)]],
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
    } finally {
      firstRegistry.dispose();
      secondRegistry.dispose();
    }
  });

  it("creates fresh lifecycle-sensitive services after a registry remount", () => {
    const config = makeConfig(vi.fn());
    const firstRegistry = AtomRegistry.make({
      initialValues: [[widgetBootstrapConfigAtom, config]],
    });
    const firstService = AsyncResult.getOrThrow(
      firstRegistry.get(firstTrackingProbeAtom)
    );

    firstRegistry.dispose();

    const remountedRegistry = AtomRegistry.make({
      initialValues: [[widgetBootstrapConfigAtom, config]],
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
    const registry = AtomRegistry.make({
      initialValues: [
        [
          widgetBootstrapConfigAtom,
          {
            ...makeConfig(vi.fn()),
            api: {
              ...defaultWidgetBootstrapConfig.api,
              borrowApiUrl: "",
            },
          },
        ],
      ],
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
