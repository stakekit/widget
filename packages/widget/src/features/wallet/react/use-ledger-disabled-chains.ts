import { useLedgerState } from "./use-ledger-state";

export const useLedgerDisabledChain = () => useLedgerState().disabledChains;
