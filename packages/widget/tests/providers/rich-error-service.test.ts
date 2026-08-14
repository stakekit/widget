import { Effect, Layer } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it, vi } from "vitest";
import { appRuntime } from "../../src/app/runtime/app-runtime";
import { richErrorAtom } from "../../src/features/widget-shell/react/use-rich-errors";
import { ApiRequestError } from "../../src/services/api/api-errors";
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
              apiKey: "",
              baseUrl,
              variant: "default",
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

  it("presents one modal per request-error identity and allows a retry occurrence", async () => {
    const registry = makeRegistry("https://api.example.com");
    const unmount = registry.mount(richErrorAtom);

    try {
      const service = AsyncResult.getOrThrow(
        registry.get(richErrorServiceAtom)
      );
      const firstFailure = new ApiRequestError({
        cause: new Error("first"),
        operation: "yield-directory",
        richError: { message: "First failure" },
      });
      service.presentRequestError(firstFailure);

      await Effect.runPromise(
        Effect.all([
          service.presentRequestError(firstFailure),
          service.presentRequestError(firstFailure),
        ])
      );
      expect(AsyncResult.getOrThrow(registry.get(richErrorAtom))).toEqual({
        message: "First failure",
      });

      await Effect.runPromise(service.reset);
      await Effect.runPromise(service.presentRequestError(firstFailure));
      expect(AsyncResult.getOrThrow(registry.get(richErrorAtom))).toBeNull();

      await Effect.runPromise(
        service.presentRequestError(
          new ApiRequestError({
            cause: new Error("retry"),
            operation: "yield-directory",
            richError: { message: "Retry failure" },
          })
        )
      );
      expect(AsyncResult.getOrThrow(registry.get(richErrorAtom))).toEqual({
        message: "Retry failure",
      });
    } finally {
      unmount();
      registry.dispose();
    }
  });
});
