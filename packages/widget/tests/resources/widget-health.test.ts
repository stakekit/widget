import { Cause, DateTime, Effect, Layer, Option } from "effect";
import { AsyncResult, Atom, AtomRegistry } from "effect/unstable/reactivity";
import { describe, expect, it, vi } from "vitest";
import { appRuntime } from "../../src/app/runtime/app-runtime";
import {
  underMaintenanceAtom,
  WidgetHealthError,
  widgetHealthResourceAtom,
} from "../../src/resources/widget-health/widget-health";
import {
  ApiRequestError,
  YieldResourceSource,
} from "../../src/services/api/resource-sources";

const makeRegistry = (getHealth: YieldResourceSource["Service"]["getHealth"]) =>
  AtomRegistry.make({
    initialValues: [
      Atom.initialValue(
        appRuntime.layer,
        Layer.succeed(
          YieldResourceSource,
          YieldResourceSource.of({ getHealth } as never)
        )
      ),
    ],
  });

describe("Widget Health resource", () => {
  it("projects healthy and maintenance states", () => {
    let status: "FAIL" | "OK" = "OK";
    const getHealth = vi.fn(() =>
      Effect.succeed({ status, timestamp: DateTime.makeUnsafe(0) })
    );
    const registry = makeRegistry(getHealth);

    expect(registry.get(underMaintenanceAtom)).toBe(false);
    status = "FAIL";
    registry.refresh(widgetHealthResourceAtom);
    expect(registry.get(underMaintenanceAtom)).toBe(true);
  });

  it("publishes typed transport failure and recovers on retry", () => {
    let offline = true;
    const requestError = new ApiRequestError({
      cause: new Error("offline"),
      operation: "yield-api-health",
    });
    const getHealth = vi.fn(() =>
      offline
        ? Effect.fail(requestError)
        : Effect.succeed({
            status: "OK" as const,
            timestamp: DateTime.makeUnsafe(0),
          })
    );
    const registry = makeRegistry(getHealth);
    const failed = registry.get(widgetHealthResourceAtom);

    expect(AsyncResult.isFailure(failed)).toBe(true);
    if (!AsyncResult.isFailure(failed)) throw new Error("Expected failure");
    expect(
      Option.getOrThrow(Cause.findErrorOption(failed.cause))
    ).toBeInstanceOf(WidgetHealthError);
    expect(registry.get(underMaintenanceAtom)).toBe(true);

    offline = false;
    registry.refresh(widgetHealthResourceAtom);
    expect(registry.get(underMaintenanceAtom)).toBe(false);
  });

  it("polls while mounted and stops after Widget Instance disposal", async () => {
    vi.useFakeTimers();
    try {
      const getHealth = vi.fn(() =>
        Effect.succeed({
          status: "OK" as const,
          timestamp: DateTime.makeUnsafe(0),
        })
      );
      const registry = makeRegistry(getHealth);
      const unmount = registry.mount(widgetHealthResourceAtom);

      expect(getHealth).toHaveBeenCalledOnce();
      await vi.advanceTimersByTimeAsync(30_000);
      expect(getHealth).toHaveBeenCalledTimes(2);

      unmount();
      registry.dispose();
      await vi.advanceTimersByTimeAsync(30_000);
      expect(getHealth).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
