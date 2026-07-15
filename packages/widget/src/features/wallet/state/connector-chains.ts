import { Effect, Stream } from "effect";
import type * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import type { Chain } from "viem";
import type { Connector } from "wagmi";
import { isConnectorWithFilteredChains } from "../../../domain/types/connectors";
import type { WalletConnectionSnapshot } from "./connection";

const disconnectedConnectorChains: Chain[] = [];

export const makeConnectorChainsStream = ({
  connector,
  defaultEvmChains,
}: {
  readonly connector: Connector | undefined;
  readonly defaultEvmChains: Chain[];
}) => {
  if (!connector || !isConnectorWithFilteredChains(connector)) {
    return Stream.succeed(defaultEvmChains);
  }

  return connector.$filteredChains.pipe(Stream.changes);
};

type ConnectorChainsController = {
  readonly evmConfig: { readonly evmChains: Chain[] };
};

export const makeConnectorChainsAtom = <ControllerError, ConnectionError>(
  controllerAtom: Atom.Atom<
    AsyncResult.AsyncResult<ConnectorChainsController, ControllerError>
  >,
  connectionAtom: Atom.Atom<
    AsyncResult.AsyncResult<WalletConnectionSnapshot, ConnectionError>
  >
) =>
  Atom.make(
    (get) =>
      Stream.unwrap(
        Effect.all([
          get.result(controllerAtom),
          get.result(connectionAtom),
        ]).pipe(
          Effect.map(([controller, connection]) =>
            makeConnectorChainsStream({
              connector: connection.connector,
              defaultEvmChains: controller.evmConfig.evmChains,
            })
          )
        )
      ),
    { initialValue: disconnectedConnectorChains }
  ).pipe(Atom.setIdleTTL(0));
