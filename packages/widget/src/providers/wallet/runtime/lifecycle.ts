import { Effect } from "effect";
import type * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { widgetAtomRuntime } from "../../effect-atom-runtime/widget-runtime";
import { TrackingService } from "../../tracking/service";
import type { NormalizedWalletState } from "../domain/state";
import type { WagmiActions } from "../wagmi/actions";

type WalletLifecycleController = {
  readonly actions: Pick<WagmiActions, "disconnect">;
};

type WalletLifecycleMemory = {
  trackedConnection: string | null;
  unsupportedConnection: string | null;
};

export const makeWalletLifecycleAtom = <ControllerError, StateError>(
  controllerAtom: Atom.Atom<
    AsyncResult.AsyncResult<WalletLifecycleController, ControllerError>
  >,
  stateAtom: Atom.Atom<
    AsyncResult.AsyncResult<NormalizedWalletState, StateError>
  >
) => {
  const memory: WalletLifecycleMemory = {
    trackedConnection: null,
    unsupportedConnection: null,
  };

  return widgetAtomRuntime
    .atom((get) =>
      Effect.gen(function* () {
        const tracking = yield* TrackingService;
        const controller = yield* get.result(controllerAtom);
        const state = yield* get.result(stateAtom);

        if (state.status === "connected") {
          const connectionKey = `${state.connector.uid}:${state.address}:${state.network}`;
          memory.unsupportedConnection = null;

          if (memory.trackedConnection === connectionKey) return;
          memory.trackedConnection = connectionKey;
          yield* tracking.trackEvent("connectedWallet", {
            address: state.address,
            network: state.network,
          });
          return;
        }

        memory.trackedConnection = null;
        if (
          state.status !== "unsupported" ||
          !state.connector ||
          !state.chain
        ) {
          memory.unsupportedConnection = null;
          return;
        }

        const connectionKey = `${state.connector.uid}:${state.address}:${state.chain.id}`;
        if (memory.unsupportedConnection === connectionKey) return;
        memory.unsupportedConnection = connectionKey;

        yield* controller.actions
          .disconnect({ connector: state.connector })
          .pipe(
            Effect.matchEffect({
              onFailure: () => Effect.void,
              onSuccess: () => Effect.void,
            })
          );
      })
    )
    .pipe(Atom.setIdleTTL(0));
};
