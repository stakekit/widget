import {
  make as makeScopedAtom,
  useAtomSet,
  useAtomValue,
} from "@effect/atom-react";
import { useContext } from "react";
import type { Chain } from "../../../services/wallet/wallet-descriptors";
import { useTrackEvent } from "../../tracking/index";
import { makeWalletChainSelectionScopeAtom } from "../state/account-presentation";
import { useLedgerDisabledChain } from "./use-ledger-disabled-chains";

const WalletChainSelectionScopedAtom = makeScopedAtom(
  makeWalletChainSelectionScopeAtom
);

/**
 * Owns the chain selections its subtree makes outside the header network
 * dialog. Unmounting it interrupts a pending selection and clears its state.
 */
export const WalletChainSelectionScope =
  WalletChainSelectionScopedAtom.Provider;

/**
 * Selects a chain within the nearest `WalletChainSelectionScope`. A Ledger
 * chain still without an account adds one, as in the header network dialog.
 */
export const useScopedWalletChainSelection = () => {
  // Not `WalletChainSelectionScopedAtom.use()`: React Compiler does not treat a
  // member named `use` as a hook and caches the call.
  const scopeAtom = useContext(WalletChainSelectionScopedAtom.Context);
  if (!scopeAtom) throw new Error("WalletChainSelectionScope is missing.");
  const select = useAtomSet(useAtomValue(scopeAtom));
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
