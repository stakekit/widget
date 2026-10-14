import { Cause, DateTime, Effect, Layer, Option } from "effect";
import { AsyncResult, Atom, AtomRegistry } from "effect/reactivity";
import { describe, expect, it, vi } from "vitest";
import { appRuntime } from "../../../src/app/runtime/app-runtime";
import {
  underMaintenanceAtom,
  WidgetHealthError,
  widgetHealthResourceAtom,
} from "../../../src/resources/widget-health/widget-health";
import {
  ApiRequestError,
  YieldResourceSource,
} from "../../../src/services/api/resource-sources";

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
    const getHealth = Effect.sync(() => ({
      status,
      timestamp: DateTime.makeUnsafe(0),
    }));
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
    const getHealth = Effect.suspend(() =>
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

  it("keeps the last known health when a later poll fails", () => {
    let offline = false;
    const getHealth = Effect.suspend(() =>
      offline
        ? Effect.fail(
            new ApiRequestError({
              cause: new Error("offline"),
              operation: "yield-api-health",
            })
          )
        : Effect.succeed({
            status: "OK" as const,
            timestamp: DateTime.makeUnsafe(0),
          })
    );
    const registry = makeRegistry(getHealth);

    try {
      expect(registry.get(underMaintenanceAtom)).toBe(false);
      offline = true;
      registry.refresh(widgetHealthResourceAtom);
      expect(
        AsyncResult.isFailure(registry.get(widgetHealthResourceAtom))
      ).toBe(true);
      expect(registry.get(underMaintenanceAtom)).toBe(false);
    } finally {
      registry.dispose();
    }
  });

  it("stays under maintenance while retrying a check that never succeeded", () => {
    let attempts = 0;
    const getHealth = Effect.suspend(() => {
      attempts += 1;
      return attempts === 1
        ? Effect.fail(
            new ApiRequestError({
              cause: new Error("offline"),
              operation: "yield-api-health",
            })
          )
        : Effect.never;
    });
    const registry = makeRegistry(getHealth);

    try {
      expect(registry.get(underMaintenanceAtom)).toBe(true);
      registry.refresh(widgetHealthResourceAtom);
      expect(registry.get(widgetHealthResourceAtom).waiting).toBe(true);
      expect(registry.get(underMaintenanceAtom)).toBe(true);
    } finally {
      registry.dispose();
    }
  });

  it("polls while mounted and stops after Widget Instance disposal", async () => {
    vi.useFakeTimers();
    try {
      const getHealth = vi.fn(() => ({
        status: "OK" as const,
        timestamp: DateTime.makeUnsafe(0),
      }));
      const registry = makeRegistry(Effect.sync(getHealth));
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
