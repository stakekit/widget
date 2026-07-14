import { Effect } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it, vi } from "vitest";
import {
  defaultWidgetBootstrapConfig,
  type WidgetBootstrapConfigValue,
  widgetBootstrapConfigAtom,
} from "../../src/providers/effect-atom-runtime/bootstrap-config";
import { widgetAtomRuntime } from "../../src/providers/effect-atom-runtime/widget-runtime";
import { TrackingService } from "../../src/providers/tracking/service";

const firstTrackingProbeAtom = widgetAtomRuntime.atom(
  TrackingService.use((tracking) => Effect.succeed(tracking))
);
const secondTrackingProbeAtom = widgetAtomRuntime.atom(
  TrackingService.use((tracking) => Effect.succeed(tracking))
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
});
