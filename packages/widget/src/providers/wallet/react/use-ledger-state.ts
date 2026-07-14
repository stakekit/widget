import { useAtomValue } from "@effect/atom-react";
import { Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import {
  useWalletInitializationKey,
  walletLedgerStateAtom,
} from "../runtime/root-atom";
import {
  disconnectedLedgerConnectorState,
  type LedgerConnectorState,
} from "../state/ledger";

export const useLedgerState = (): LedgerConnectorState => {
  const initializationKey = useWalletInitializationKey();

  return useAtomValue(walletLedgerStateAtom(initializationKey)).pipe(
    AsyncResult.value,
    Option.getOrElse(() => disconnectedLedgerConnectorState)
  );
};
