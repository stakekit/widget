import { useAtomSet, useAtomValue } from "@effect/atom-react";

import { usePositionDetails } from "../../../react/use-position-details";
import type { PositionDetailsEnterKey } from "../../../state/enter-entry";
import {
  hidePositionDetailsEnterTokenBalanceAtom,
  positionDetailsEnterViewAtom,
  refreshPositionDetailsEnterKycAtom,
  revealPositionDetailsEnterTokenBalanceAtom,
  selectPositionDetailsEnterTokenAtom,
  setPositionDetailsEnterAmountAtom,
  setPositionDetailsEnterMaxAmountAtom,
  setPositionDetailsEnterTronResourceAtom,
  submitPositionDetailsEnterAtom,
} from "../../../state/enter-view";

export const usePositionDetailsEnter = (key: PositionDetailsEnterKey) => {
  const view = useAtomValue(positionDetailsEnterViewAtom(key));
  const refreshKyc = useAtomSet(refreshPositionDetailsEnterKycAtom(key));
  const setAmount = useAtomSet(setPositionDetailsEnterAmountAtom(key));
  const setMaxAmount = useAtomSet(setPositionDetailsEnterMaxAmountAtom(key));
  const setTronResource = useAtomSet(
    setPositionDetailsEnterTronResourceAtom(key)
  );
  const submit = useAtomSet(submitPositionDetailsEnterAtom(key));
  const selectToken = useAtomSet(selectPositionDetailsEnterTokenAtom(key));
  const revealTokenBalance = useAtomSet(
    revealPositionDetailsEnterTokenBalanceAtom(key)
  );
  const hideTokenBalance = useAtomSet(
    hidePositionDetailsEnterTokenBalanceAtom(key)
  );
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
    onRevealTokenBalance: () => revealTokenBalance(undefined),
    onStakeAmountChange: setAmount,
    onTokenSelect: selectToken,
    onTronResourceSelect: setTronResource,
    positionDetails,
  };
};
