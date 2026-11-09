import { Effect, Layer, Option, Stream } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { describe, expect, it, vi } from "vitest";

import {
  walletConfigResultAtom,
  walletStateResultAtom,
} from "../../../src/features/wallet/index";
import { walletLedgerStateResultAtom as walletLedgerStateAtom } from "../../../src/features/wallet/state/root-atom";
import { walletRuntime } from "../../../src/runtime/wallet-runtime";
import { makeDefaultConfig } from "../../../src/services/wallet/default-wagmi-config";
import { WalletService } from "../../../src/services/wallet/wallet-service";
import {
  disconnectedLedgerConnectorState,
  disconnectedNormalizedWalletState,
  type WalletState,
} from "../../../src/services/wallet/wallet-state";

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
