import { Effect } from "effect";
import type { TrackingService } from "../tracking/tracking-service";
import type { NormalizedWalletState } from "./domain/state";
import type { WagmiActions } from "./wagmi-actions";

type WalletLifecycleMemory = {
  trackedConnection: string | null;
  unsupportedConnection: string | null;
};

type WalletLifecycleInput = {
  readonly actions: Pick<WagmiActions, "disconnect">;
  readonly state: NormalizedWalletState;
};

export const makeWalletLifecyclePolicy = ({
  trackEvent,
}: Pick<TrackingService["Service"], "trackEvent">) => {
  const memory: WalletLifecycleMemory = {
    trackedConnection: null,
    unsupportedConnection: null,
  };

  const transition = ({
    actions,
    state,
  }: WalletLifecycleInput): Effect.Effect<void> | null => {
    if (state.status === "connected") {
      const connectionKey = `${state.connector.uid}:${state.address}:${state.network}`;
      memory.unsupportedConnection = null;

      if (memory.trackedConnection === connectionKey) return null;
      memory.trackedConnection = connectionKey;

      return trackEvent("connectedWallet", {
        address: state.address,
        network: state.network,
      }).pipe(Effect.catchCause(() => Effect.void));
    }

    memory.trackedConnection = null;
    if (state.status !== "unsupported" || !state.connector || !state.chain) {
      memory.unsupportedConnection = null;
      return null;
    }

    const connectionKey = `${state.connector.uid}:${state.address}:${state.chain.id}`;
    if (memory.unsupportedConnection === connectionKey) return null;
    memory.unsupportedConnection = connectionKey;

    return actions
      .disconnect({ connector: state.connector })
      .pipe(Effect.catchCause(() => Effect.void));
  };

  return { transition } as const;
};
