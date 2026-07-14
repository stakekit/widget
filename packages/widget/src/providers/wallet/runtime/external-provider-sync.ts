import { Effect } from "effect";
import type * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import type { Config, Connector } from "wagmi";
import type {
  DynamicExternalProviderInput,
  dynamicExternalProviderInputAtom,
} from "../../effect-atom-runtime/root-inputs";
import { isExternalProviderConnector } from "../../external-provider";
import type { WalletConnectionSnapshot } from "../state/connection";
import type { WagmiActions } from "../wagmi/actions";

type ExternalProviderSyncController = {
  readonly actions: Pick<WagmiActions, "connect">;
  readonly wagmiConfig: Config;
};

type ExternalProviderSyncMemory = {
  connecting: string | null;
  supportedChains: string | null;
};

export const makeExternalProviderSyncAtom = <
  ControllerError,
  ConnectorsError,
  ConnectionError,
>(
  controllerAtom: Atom.Atom<
    AsyncResult.AsyncResult<ExternalProviderSyncController, ControllerError>
  >,
  connectorsAtom: Atom.Atom<
    AsyncResult.AsyncResult<ReadonlyArray<Connector>, ConnectorsError>
  >,
  connectionAtom: Atom.Atom<
    AsyncResult.AsyncResult<WalletConnectionSnapshot, ConnectionError>
  >,
  dynamicInputAtom: typeof dynamicExternalProviderInputAtom
) => {
  const memory: ExternalProviderSyncMemory = {
    connecting: null,
    supportedChains: null,
  };

  return Atom.make((get) =>
    Effect.gen(function* () {
      const input: DynamicExternalProviderInput = get(dynamicInputAtom);
      if (!input) {
        memory.connecting = null;
        memory.supportedChains = null;
        return;
      }

      const controller = yield* get.result(controllerAtom);
      const connectors = yield* get.result(connectorsAtom);
      const connection = yield* get.result(connectionAtom);
      const connector = connectors.find(isExternalProviderConnector);
      if (!connector) return;

      const currentChainId =
        input.currentChain ??
        connection.chainId ??
        controller.wagmiConfig.state.chainId;
      const supportedChainsKey = `${connector.uid}:${currentChainId}:${
        input.supportedChainIds?.join(",") ?? "all"
      }`;
      if (memory.supportedChains !== supportedChainsKey) {
        memory.supportedChains = supportedChainsKey;
        yield* Effect.try({
          try: () =>
            connector.onSupportedChainsChanged({
              currentChainId,
              supportedChainIds: input.supportedChainIds
                ? [...input.supportedChainIds]
                : [],
            }),
          catch: () => undefined,
        }).pipe(
          Effect.matchEffect({
            onFailure: () => Effect.void,
            onSuccess: () => Effect.void,
          })
        );
      }

      if (
        connection.status !== "connected" &&
        connection.status !== "connecting" &&
        connection.status !== "reconnecting" &&
        input.currentAddress
      ) {
        const connectingKey = `${connector.uid}:${input.currentAddress}`;
        if (memory.connecting === connectingKey) return;
        memory.connecting = connectingKey;
        yield* controller.actions.connect({ connector }).pipe(
          Effect.matchEffect({
            onFailure: () =>
              Effect.sync(() => {
                memory.connecting = null;
              }),
            onSuccess: () => Effect.void,
          })
        );
        return;
      }

      if (
        connection.status !== "connected" ||
        connection.connector?.uid !== connector.uid
      ) {
        return;
      }

      memory.connecting = null;
      if (connection.address !== input.currentAddress) {
        yield* Effect.sync(() =>
          connector.onAccountsChanged([input.currentAddress])
        );
      }
      if (input.currentChain && connection.chainId !== input.currentChain) {
        yield* Effect.sync(() =>
          connector.onChainChanged(input.currentChain!.toString())
        );
      }
    })
  ).pipe(Atom.setIdleTTL(0));
};
