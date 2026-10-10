import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { SolanaPlatform } from "../../../src/services/wallet/internal/platform/solana-platform";
import { WalletConnectPresentationPlatform } from "../../../src/services/wallet/internal/platform/wallet-connect-presentation";
import { WalletConnectProtocolPlatform } from "../../../src/services/wallet/internal/platform/wallet-connect-protocol";
import { WalletModal } from "../../../src/services/wallet/wallet-modal";

describe("SolanaPlatform", () => {
  it.effect("does not expose wallet adapters when adapters are disabled", () =>
    Effect.gen(function* () {
      const result = yield* Effect.scoped(
        Effect.gen(function* () {
          const platform = yield* SolanaPlatform;
          const runtime = yield* platform.makeRuntime({
            includeWalletAdapters: false,
          });
          return yield* runtime.current;
        }).pipe(
          Effect.provide(
            SolanaPlatform.layer.pipe(
              Layer.provide(WalletConnectProtocolPlatform.layer),
              Layer.provide(WalletConnectPresentationPlatform.layer),
              Layer.provide(WalletModal.layer)
            )
          )
        )
      );

      expect(result).toEqual({ wallets: [] });
    })
  );
});
