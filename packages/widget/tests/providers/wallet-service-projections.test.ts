import { Effect, Layer, Option, Stream } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it, vi } from "vitest";
import { walletRuntime } from "../../src/app/runtime/wallet-runtime";
import {
  walletConfigResultAtom,
  walletStateResultAtom,
} from "../../src/features/wallet/state";
import { currentWalletLedgerStateAtom as walletLedgerStateAtom } from "../../src/features/wallet/state/root-atom";
import { makeDefaultConfig } from "../../src/services/wallet/default-wagmi-config";
import {
  disconnectedLedgerConnectorState,
  disconnectedNormalizedWalletState,
  type WalletState,
} from "../../src/services/wallet/domain/state";
import { WalletService } from "../../src/services/wallet/wallet-service";

describe("WalletService projections", () => {
  it("projects one cohesive Wallet State and stable Wagmi config", async () => {
    const wagmiConfig = makeDefaultConfig();
    const walletState = {
      connection: disconnectedNormalizedWalletState,
      ledger: disconnectedLedgerConnectorState,
    } satisfies WalletState;
    const registry = AtomRegistry.make({
      initialValues: [
        [
          walletRuntime.layer,
          Layer.succeed(WalletService, {
            state: Effect.succeed(walletState),
            states: Stream.succeed(walletState),
            wagmiConfig,
          } as never) as never,
        ],
      ],
    });

    registry.mount(walletConfigResultAtom);
    registry.mount(walletStateResultAtom);
    registry.mount(walletLedgerStateAtom);

    await vi.waitFor(() => {
      expect(
        Option.getOrThrow(
          AsyncResult.value(registry.get(walletConfigResultAtom))
        )
      ).toBe(wagmiConfig);
      expect(
        Option.getOrThrow(
          AsyncResult.value(registry.get(walletStateResultAtom))
        )
      ).toBe(walletState.connection);
      expect(
        Option.getOrThrow(
          AsyncResult.value(registry.get(walletLedgerStateAtom))
        )
      ).toBe(walletState.ledger);
    });

    registry.dispose();
  });
});
