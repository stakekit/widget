import { Layer } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it, vi } from "vitest";
import { appRuntime } from "../../src/app/runtime/app-runtime";
import { richErrorAtom } from "../../src/features/widget-shell/react/use-rich-errors";
import { makePresentableResource } from "../../src/resources/resource-failure-presentation";
import { ApiRequestError } from "../../src/services/api/resource-sources";
import { WidgetConfigService } from "../../src/services/config/widget-config";
import { RichErrorService } from "../../src/services/errors/rich-error-service";

const makeRegistry = () =>
  AtomRegistry.make({
    initialValues: [
      [
        appRuntime.layer,
        RichErrorService.layer.pipe(
          Layer.provide(
            WidgetConfigService.layer({
              apiKey: "test-api-key",
              baseUrl: "https://api.example.com",
              variant: "default",
            })
          ),
          Layer.fresh
        ),
      ],
    ],
  });

const makeRequestError = (message: string) =>
  new ApiRequestError({
    cause: new Error(message),
    operation: "test-resource",
    richError: { message },
  });

const presentableFailure = (message: string) => {
  let acquisitions = 0;
  const requestError = makeRequestError(message);
  const canonical = Atom.make(() => {
    acquisitions += 1;
    return AsyncResult.fail({ cause: requestError });
  });

  return {
    acquisitions: () => acquisitions,
    requestError,
    resource: makePresentableResource(canonical),
  };
};

describe("resource failure presentation", () => {
  it("keeps local-only observation silent", async () => {
    const registry = makeRegistry();
    const { resource } = presentableFailure("Local failure");
    const unmount = registry.mount(resource.local);

    try {
      expect(registry.get(resource.local)._tag).toBe("Failure");
      expect(AsyncResult.getOrThrow(registry.get(richErrorAtom))).toBeNull();
    } finally {
      unmount();
      registry.dispose();
    }
  });

  it("presents a foreground-only failure", async () => {
    const registry = makeRegistry();
    const { resource } = presentableFailure("Foreground failure");
    const unmount = registry.mount(resource.foreground);

    try {
      await vi.waitFor(() => {
        expect(AsyncResult.getOrThrow(registry.get(richErrorAtom))).toEqual({
          message: "Foreground failure",
        });
      });
    } finally {
      unmount();
      registry.dispose();
    }
  });

  it.each(["local-first", "foreground-first"] as const)(
    "shares one canonical acquisition and presents for %s observation",
    async (order) => {
      const registry = makeRegistry();
      const { acquisitions, resource } = presentableFailure("Visible failure");
      const first =
        order === "local-first" ? resource.local : resource.foreground;
      const second =
        order === "local-first" ? resource.foreground : resource.local;
      const unmountFirst = registry.mount(first);
      const unmountSecond = registry.mount(second);

      try {
        await vi.waitFor(() => {
          expect(AsyncResult.getOrThrow(registry.get(richErrorAtom))).toEqual({
            message: "Visible failure",
          });
        });
        expect(acquisitions()).toBe(1);
      } finally {
        unmountSecond();
        unmountFirst();
        registry.dispose();
      }
    }
  );

  it("deduplicates a dismissed failure across remount and presents a refreshed occurrence", async () => {
    const registry = makeRegistry();
    let attempts = 0;
    const canonical = Atom.make(() => {
      attempts += 1;
      return AsyncResult.fail({
        cause: makeRequestError(`Failure ${attempts}`),
      });
    });
    const resource = makePresentableResource(canonical);
    const unmountFirst = registry.mount(resource.foreground);

    await vi.waitFor(() => {
      expect(AsyncResult.getOrThrow(registry.get(richErrorAtom))).toEqual({
        message: "Failure 1",
      });
    });
    registry.set(richErrorAtom, null);
    unmountFirst();

    const unmountSecond = registry.mount(resource.foreground);
    try {
      registry.get(resource.foreground);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      expect(AsyncResult.getOrThrow(registry.get(richErrorAtom))).toBeNull();

      registry.refresh(resource.local);
      await vi.waitFor(() => {
        expect(AsyncResult.getOrThrow(registry.get(richErrorAtom))).toEqual({
          message: "Failure 2",
        });
      });
      expect(attempts).toBe(2);
    } finally {
      unmountSecond();
      registry.dispose();
    }
  });
});
