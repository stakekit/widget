import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { useId } from "react";
import type { Chain } from "../../../services/wallet/wallet-descriptors";
import { useTrackEvent } from "../../tracking/index";
import { walletChainSelectionScopeAtom } from "../state/account-presentation";
import { useLedgerDisabledChain } from "./use-ledger-disabled-chains";

/**
 * Selects a chain outside the header network dialog, in a selection the
 * calling component owns: unmounting it interrupts a pending selection and
 * clears its state. A Ledger chain still without an account adds one, as in
 * the header network dialog.
 */
export const useScopedWalletChainSelection = () => {
  const select = useAtomSet(
    useAtomValue(walletChainSelectionScopeAtom(useId()))
  );
  const trackEvent = useTrackEvent();
  const disabledChainIds = new Set(
    useLedgerDisabledChain().map((chain) => chain.id)
  );

  return {
    disabledChainIds,
    selectChain: (chain: Chain) => {
      const addLedgerAccount = disabledChainIds.has(chain.id);
      if (addLedgerAccount) trackEvent("addLedgerAccountClicked");
      select({ addLedgerAccount, chain });
    },
  } as const;
};
