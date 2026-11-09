import { useAtomValue } from "@effect/atom-react";

import type { LedgerConnectorState } from "../../../services/wallet/wallet-state";
import { walletLedgerStateAtom } from "../state/root-atom";

export const useLedgerState = (): LedgerConnectorState =>
  useAtomValue(walletLedgerStateAtom);
