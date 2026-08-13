import { useAtomValue } from "@effect/atom-react";
import { Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import {
  disconnectedLedgerConnectorState,
  type LedgerConnectorState,
} from "../../../services/wallet/wallet-state";
import { currentWalletLedgerStateAtom } from "../state/root-atom";

export const useLedgerState = (): LedgerConnectorState => {
  return useAtomValue(currentWalletLedgerStateAtom).pipe(
    AsyncResult.value,
    Option.getOrElse(() => disconnectedLedgerConnectorState)
  );
};
