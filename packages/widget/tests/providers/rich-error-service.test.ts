import { Effect, Layer, Stream } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it, vi } from "vitest";
import { normalizeWidgetConfig } from "../../src/app/config";
import { appRuntime } from "../../src/app/runtime";
import { richErrorAtom } from "../../src/features/widget-shell";
import { WidgetConfigService } from "../../src/services/config/widget-config";
import { RichErrorService } from "../../src/services/errors/rich-error-service";

const richErrorServiceAtom = appRuntime.atom(
  Effect.map(RichErrorService, (service) => service)
);

const makeRegistry = (baseUrl: string) =>
  AtomRegistry.make({
    initialValues: [
      [
        appRuntime.layer,
        RichErrorService.layer.pipe(
          Layer.provide(
            WidgetConfigService.layer({
              initial: normalizeWidgetConfig({
                apiKey: "",
                baseUrl,
                variant: "default",
              }),
              changes: Stream.never,
              current: Effect.never,
            })
          ),
          Layer.fresh
        ),
      ],
    ],
  });

describe("rich error service", () => {
  it("publishes, resets, and isolates registry state", async () => {
    const first = makeRegistry("https://first.example.com");
    const second = makeRegistry("https://second.example.com");
    const unmountFirst = first.mount(richErrorAtom);
    const unmountSecond = second.mount(richErrorAtom);

    try {
      const firstService = AsyncResult.getOrThrow(
        first.get(richErrorServiceAtom)
      );
      const secondService = AsyncResult.getOrThrow(
        second.get(richErrorServiceAtom)
      );

      await Effect.runPromise(
        firstService.publishResponse({
          data: { message: "First failure" },
          url: "https://first.example.com/v1/tokens",
        })
      );

      await vi.waitFor(() => {
        expect(AsyncResult.getOrThrow(first.get(richErrorAtom))).toEqual({
          message: "First failure",
        });
      });
      expect(AsyncResult.getOrThrow(second.get(richErrorAtom))).toBeNull();

      first.set(richErrorAtom, null);
      expect(AsyncResult.getOrThrow(first.get(richErrorAtom))).toBeNull();
      expect(AsyncResult.getOrThrow(second.get(richErrorAtom))).toBeNull();

      await Effect.runPromise(
        secondService.publishResponse({
          data: { message: "Ignored wrong origin" },
          url: "https://first.example.com/v1/tokens",
        })
      );
      expect(AsyncResult.getOrThrow(second.get(richErrorAtom))).toBeNull();
    } finally {
      unmountFirst();
      unmountSecond();
      first.dispose();
      second.dispose();
    }
  });
});
