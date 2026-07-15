import { useAtomValue } from "@effect/atom-react";
import { Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { currentWalletLedgerStateAtom } from "../runtime/root-atom";
import {
  disconnectedLedgerConnectorState,
  type LedgerConnectorState,
} from "../state/ledger";

export const useLedgerState = (): LedgerConnectorState => {
  return useAtomValue(currentWalletLedgerStateAtom).pipe(
    AsyncResult.value,
    Option.getOrElse(() => disconnectedLedgerConnectorState)
  );
};
