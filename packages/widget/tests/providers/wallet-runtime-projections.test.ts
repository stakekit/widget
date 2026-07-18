import { Effect, Layer, Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it, vi } from "vitest";
import { appRuntime } from "../../src/app/runtime";
import {
  currentWalletConnectionResultAtom,
  currentWalletConnectorsResultAtom,
} from "../../src/features/wallet";
import { walletControllerAtom } from "../../src/features/wallet/wagmi/controller";
import type { WalletInitializationKey } from "../../src/features/wallet/wagmi/initialization";
import {
  bootstrappingWalletRuntimeSnapshot,
  type WalletRuntimeSnapshot,
} from "../../src/services/wallet/domain/runtime";
import { WalletService } from "../../src/services/wallet/wallet-service";
import { makeCurrentValueStream } from "../../src/shared/effect/current-value-stream";

describe("WalletService read-only projections", () => {
  it("surfaces bootstrap failure instead of retaining loading or disconnected values", async () => {
    const cause = new Error("wallet bootstrap failed");
    const source = makeCurrentValueStream<WalletRuntimeSnapshot>(
      bootstrappingWalletRuntimeSnapshot
    );
    const controllerAtom = walletControllerAtom({} as WalletInitializationKey);
    const registry = AtomRegistry.make({
      initialValues: [
        [
          appRuntime.layer,
          Layer.succeed(WalletService, {
            changes: source.changes,
            legacyController: Effect.succeed(null),
          } as never) as never,
        ],
      ],
    });

    registry.mount(controllerAtom);
    registry.mount(currentWalletConnectionResultAtom);
    registry.mount(currentWalletConnectorsResultAtom);
    source.set({
      cause,
      phase: "BootstrapFailed",
      projection: null,
      wagmiConfig: null,
    });

    await vi.waitFor(() => {
      const errors = [
        Option.getOrThrow(AsyncResult.error(registry.get(controllerAtom))),
        Option.getOrThrow(
          AsyncResult.error(registry.get(currentWalletConnectionResultAtom))
        ),
        Option.getOrThrow(
          AsyncResult.error(registry.get(currentWalletConnectorsResultAtom))
        ),
      ];

      for (const error of errors) {
        expect(error).toMatchObject({
          _tag: "WalletRuntimeTerminalError",
          cause,
          phase: "BootstrapFailed",
        });
      }
    });

    registry.dispose();
  });
});
