import { Effect, Layer } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it, vi } from "vitest";
import { richErrorAtom } from "../../src/hooks/use-rich-errors";
import {
  defaultWidgetBootstrapConfig,
  WidgetBootstrapConfig,
} from "../../src/providers/effect-atom-runtime/bootstrap-config";
import { widgetAtomRuntime } from "../../src/providers/effect-atom-runtime/widget-runtime";
import { RichErrorService } from "../../src/providers/rich-error/service";

const richErrorServiceAtom = widgetAtomRuntime.atom(
  Effect.map(RichErrorService, (service) => service)
);

const makeRegistry = (baseUrl: string) =>
  AtomRegistry.make({
    initialValues: [
      [
        widgetAtomRuntime.layer,
        RichErrorService.layer.pipe(
          Layer.provide(
            WidgetBootstrapConfig.layer({
              ...defaultWidgetBootstrapConfig,
              api: {
                ...defaultWidgetBootstrapConfig.api,
                baseUrl,
              },
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
