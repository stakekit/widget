import { Effect, Stream } from "effect";
import type * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { isLedgerLiveConnector } from "../../../services/wallet/connectors/ledger/ledger-live-connector-meta";
import {
  disconnectedLedgerConnectorState,
  type LedgerConnectorState,
} from "../../../services/wallet/domain/state";
import type { WalletConnectionSnapshot } from "./connection";

export {
  disconnectedLedgerConnectorState,
  type LedgerConnectorState,
} from "../../../services/wallet/domain/state";

export const makeLedgerConnectorStateStream = (
  connector: WalletConnectionSnapshot["connector"]
) => {
  if (!connector || !isLedgerLiveConnector(connector)) {
    return Stream.succeed(disconnectedLedgerConnectorState);
  }

  return Stream.zipLatestAll(
    connector.$accountsOnCurrentChain,
    connector.$currentAccountId,
    connector.$disabledChains
  ).pipe(
    Stream.map(
      ([accounts, currentAccountId, disabledChains]) =>
        ({
          accounts,
          currentAccountId,
          disabledChains,
        }) satisfies LedgerConnectorState
    ),
    Stream.changes
  );
};

export const makeLedgerConnectorStateAtom = <ConnectionError>(
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
              makeLedgerConnectorStateStream(connection.connector)
            )
          )
      ),
    { initialValue: disconnectedLedgerConnectorState }
  ).pipe(Atom.setIdleTTL(0));
