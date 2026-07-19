import { Effect, Ref } from "effect";
import { TrackingService } from "../tracking/tracking-service";
import type { NormalizedWalletState } from "./domain/state";
import type { WagmiActions } from "./wagmi-actions";

type WalletLifecycleMemory = {
  readonly trackedConnection: string | null;
  readonly unsupportedConnection: string | null;
};

type WalletLifecycleInput = {
  readonly actions: Pick<WagmiActions, "disconnect">;
  readonly state: NormalizedWalletState;
};

export const makeWalletLifecyclePolicy = Effect.gen(function* () {
  const initialMemory: WalletLifecycleMemory = {
    trackedConnection: null,
    unsupportedConnection: null,
  };
  const tracking = yield* TrackingService;
  const memory = yield* Ref.make(initialMemory);

  const transition = Effect.fn("transition")(function* ({
    actions,
    state,
  }: WalletLifecycleInput) {
    const operation = yield* Ref.modify(memory, (current) => {
      if (state.status === "connected") {
        const connectionKey = `${state.connector.uid}:${state.address}:${state.network}`;
        if (current.trackedConnection === connectionKey) {
          return [null, { ...current, unsupportedConnection: null }];
        }
        return [
          tracking.trackEvent("connectedWallet", {
            address: state.address,
            network: state.network,
          }),
          {
            trackedConnection: connectionKey,
            unsupportedConnection: null,
          },
        ];
      }

      if (state.status !== "unsupported" || !state.connector || !state.chain) {
        return [null, initialMemory];
      }

      const connectionKey = `${state.connector.uid}:${state.address}:${state.chain.id}`;
      if (current.unsupportedConnection === connectionKey) {
        return [null, { ...current, trackedConnection: null }];
      }
      return [
        actions.disconnect({ connector: state.connector }),
        {
          trackedConnection: null,
          unsupportedConnection: connectionKey,
        },
      ];
    });

    if (operation) {
      yield* operation.pipe(
        Effect.catchCause((cause) =>
          Effect.logWarning("Wallet lifecycle operation failed").pipe(
            Effect.annotateLogs({ cause })
          )
        )
      );
    }
  });

  return { transition } as const;
});
