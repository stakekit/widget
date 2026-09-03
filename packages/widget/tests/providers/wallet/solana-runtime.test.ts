import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, Stream } from "effect";
import {
  SolanaPlatform,
  type SolanaRuntime,
} from "../../../src/services/wallet/internal/platform/solana-platform";

describe("SolanaPlatform", () => {
  it.effect(
    "constructs only a scoped connection when adapters are disabled",
    () =>
      Effect.gen(function* () {
        const result = yield* Effect.scoped(
          Effect.gen(function* () {
            const platform = yield* SolanaPlatform;
            const runtime = yield* platform.makeRuntime({
              includeWalletAdapters: false,
            });
            return {
              endpoint: runtime.connection.rpcEndpoint,
              snapshot: yield* runtime.current,
            };
          }).pipe(Effect.provide(SolanaPlatform.layer))
        );

        expect(result.endpoint).toContain("solana.com");
        expect(result.snapshot).toEqual({ wallets: [] });
      })
  );

  it.effect("is replaceable through an Effect Layer", () =>
    Effect.gen(function* () {
      const expected = { wallets: [] } as const;
      const fake = {
        connection: { rpcEndpoint: "https://solana.test" },
        current: Effect.succeed(expected),
        states: Stream.succeed(expected),
      } as unknown as SolanaRuntime;
      const layer = Layer.succeed(
        SolanaPlatform,
        SolanaPlatform.of({ makeRuntime: () => Effect.succeed(fake) })
      );

      const runtime = yield* Effect.gen(function* () {
        const platform = yield* SolanaPlatform;
        return yield* platform.makeRuntime({ includeWalletAdapters: true });
      }).pipe(Effect.provide(layer), Effect.scoped);

      expect(runtime).toBe(fake);
    })
  );
});
