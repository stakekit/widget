import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { usePositionDetails } from "../../../react/use-position-details";
import type { PositionDetailsEnterKey } from "../../../state/enter-entry";
import { positionDetailsEnterAtoms } from "../../../state/enter-view";

export const usePositionDetailsEnter = (key: PositionDetailsEnterKey) => {
  const atoms = useAtomValue(positionDetailsEnterAtoms(key));
  const view = useAtomValue(atoms.viewAtom);
  const refreshKyc = useAtomSet(atoms.refreshKycAtom);
  const setAmount = useAtomSet(atoms.setAmountAtom);
  const setMaxAmount = useAtomSet(atoms.setMaxAmountAtom);
  const setTronResource = useAtomSet(atoms.setTronResourceAtom);
  const submit = useAtomSet(atoms.submitAtom);
  const selectToken = useAtomSet(atoms.selectTokenAtom);
  const revealTokenBalance = useAtomSet(atoms.revealTokenBalanceAtom);
  const hideTokenBalance = useAtomSet(atoms.hideTokenBalanceAtom);
  const retry = useAtomSet(atoms.retryAtom);
  const positionDetails = usePositionDetails();

  return {
    ...view,
    kycGate: view.kyc.gate,
    kycGateIsChecking: view.kyc.isChecking,
    kycProviderName: view.kyc.providerName,
    onHideTokenBalance: () => hideTokenBalance(undefined),
    onKycStatusRefresh: () => refreshKyc(undefined),
    onMaxClick: () => setMaxAmount(undefined),
    onPrimaryAction: () => submit(undefined),
    onRetry: () => retry(undefined),
    onRevealTokenBalance: () => revealTokenBalance(undefined),
    onStakeAmountChange: setAmount,
    onTokenSelect: selectToken,
    onTronResourceSelect: setTronResource,
    positionDetails,
  };
};
