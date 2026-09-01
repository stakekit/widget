import { describe, expect, it } from "@effect/vitest";
import { Cause, Effect, Exit, Fiber, Stream } from "effect";
import { walletCommandIdentity } from "../../../src/services/wallet/wallet-command-identity";
import {
  disconnectedLedgerConnectorState,
  disconnectedNormalizedWalletState,
  type WalletState,
} from "../../../src/services/wallet/wallet-state";
import { makeTestWallet } from "./wallet-service";

const disconnectedState: WalletState = {
  connection: disconnectedNormalizedWalletState,
  ledger: disconnectedLedgerConnectorState,
};

const connectingState: WalletState = {
  ...disconnectedState,
  connection: {
    ...disconnectedNormalizedWalletState,
    status: "connecting",
  },
};

describe("makeTestWallet", () => {
  it.effect("keeps state reads and the state stream in sync", () =>
    Effect.gen(function* () {
      const wallet = yield* makeTestWallet({ initialState: disconnectedState });
      const states = yield* wallet.service.states.pipe(
        Stream.take(2),
        Stream.runCollect,
        Effect.forkChild({ startImmediately: true })
      );

      yield* wallet.setState(connectingState);

      expect(yield* wallet.walletState).toEqual(connectingState);
      expect(Array.from(yield* Fiber.join(states))).toEqual([
        disconnectedState,
        connectingState,
      ]);
    })
  );

  it.effect("uses configured wallet commands", () =>
    Effect.gen(function* () {
      const wallet = yield* makeTestWallet({
        addLedgerAccount: () => Effect.succeed({ _tag: "Added" }),
        initialState: disconnectedState,
      });

      const outcome = yield* wallet.service.addLedgerAccount({
        expected: walletCommandIdentity(disconnectedState.connection),
      });

      expect(outcome).toEqual({ _tag: "Added" });
    })
  );

  it.effect("dies with the method name for an unconfigured command", () =>
    Effect.gen(function* () {
      const wallet = yield* makeTestWallet({ initialState: disconnectedState });
      const exit = yield* Effect.exit(wallet.service.logout);

      expect(Exit.isFailure(exit)).toBe(true);
      expect(Exit.isFailure(exit) ? Cause.squash(exit.cause) : null).toBe(
        "makeTestWallet: unexpected call to logout"
      );
    })
  );
});
