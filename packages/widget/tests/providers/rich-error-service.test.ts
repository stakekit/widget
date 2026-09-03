import { describe, expect, it, vi } from "@effect/vitest";
import { Effect, Layer } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { appRuntime } from "../../src/app/runtime/app-runtime";
import { richErrorAtom } from "../../src/features/widget-shell/react/use-rich-errors";
import { ApiRequestError } from "../../src/services/api/resource-sources";
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
              apiKey: "test-api-key",
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
  it.effect("presents, resets, and isolates registry state", () =>
    Effect.gen(function* () {
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

        yield* firstService.present(
          new ApiRequestError({
            cause: new Error("first"),
            operation: "test",
            richError: { message: "First failure" },
          })
        );

        yield* Effect.promise(() =>
          vi.waitFor(() => {
            expect(AsyncResult.getOrThrow(first.get(richErrorAtom))).toEqual({
              message: "First failure",
            });
          })
        );
        expect(AsyncResult.getOrThrow(second.get(richErrorAtom))).toBeNull();

        first.set(richErrorAtom, null);
        expect(AsyncResult.getOrThrow(first.get(richErrorAtom))).toBeNull();
        expect(AsyncResult.getOrThrow(second.get(richErrorAtom))).toBeNull();

        yield* secondService.present(
          new ApiRequestError({
            cause: new Error("second"),
            operation: "test",
            richError: { message: "Second failure" },
          })
        );
        expect(AsyncResult.getOrThrow(second.get(richErrorAtom))).toEqual({
          message: "Second failure",
        });
      } finally {
        unmountFirst();
        unmountSecond();
        first.dispose();
        second.dispose();
      }
    })
  );

  it.effect(
    "presents one modal per request-error identity and allows a retry occurrence",
    () =>
      Effect.gen(function* () {
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
          yield* Effect.all([
            service.present(firstFailure),
            service.present(firstFailure),
          ]);
          expect(AsyncResult.getOrThrow(registry.get(richErrorAtom))).toEqual({
            message: "First failure",
          });

          yield* service.reset;
          yield* service.present(firstFailure);
          expect(
            AsyncResult.getOrThrow(registry.get(richErrorAtom))
          ).toBeNull();

          yield* service.present(
            new ApiRequestError({
              cause: new Error("retry"),
              operation: "yield-directory",
              richError: { message: "Retry failure" },
            })
          );
          expect(AsyncResult.getOrThrow(registry.get(richErrorAtom))).toEqual({
            message: "Retry failure",
          });
        } finally {
          unmount();
          registry.dispose();
        }
      })
  );
});
