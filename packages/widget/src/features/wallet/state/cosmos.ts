import type { ChainWalletBase } from "@cosmos-kit/core";
import { Effect, Stream } from "effect";
import type * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { isCosmosConnector } from "../../../services/wallet/connectors/cosmos/cosmos-connector-meta";
import type { WalletConnectionSnapshot } from "./connection";

export const disconnectedCosmosChainWallet: ChainWalletBase | null = null;

export const makeCosmosChainWalletStream = (
  connector: WalletConnectionSnapshot["connector"]
) => {
  if (!connector || !isCosmosConnector(connector)) {
    return Stream.succeed(disconnectedCosmosChainWallet);
  }

  return connector.$chainWallet.pipe(Stream.changes);
};

export const makeCosmosChainWalletAtom = <ConnectionError>(
  connectionAtom: Atom.Atom<
    AsyncResult.AsyncResult<WalletConnectionSnapshot, ConnectionError>
  >
) =>
  Atom.make(
    (get) =>
      Stream.unwrap(
        get
          .result(connectionAtom)
          .pipe(
            Effect.map((connection) =>
              makeCosmosChainWalletStream(connection.connector)
            )
          )
      ),
    { initialValue: disconnectedCosmosChainWallet }
  ).pipe(Atom.setIdleTTL(0));
