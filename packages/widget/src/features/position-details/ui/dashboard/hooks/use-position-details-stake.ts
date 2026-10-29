import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { usePositionDetails } from "../../../react/use-position-details";
import type { PositionDetailsStakeEntryKey } from "../../../state/stake-entry";
import {
  hidePositionDetailsStakeTokenBalanceAtom,
  positionDetailsStakeViewAtom,
  refreshPositionDetailsStakeKycAtom,
  revealPositionDetailsStakeTokenBalanceAtom,
  selectPositionDetailsStakeTokenAtom,
  setPositionDetailsStakeAmountAtom,
  setPositionDetailsStakeMaxAmountAtom,
  setPositionDetailsStakeTronResourceAtom,
  submitPositionDetailsStakeAtom,
} from "../../../state/stake-view";

export const usePositionDetailsStake = (key: PositionDetailsStakeEntryKey) => {
  const view = useAtomValue(positionDetailsStakeViewAtom(key));
  const refreshKyc = useAtomSet(refreshPositionDetailsStakeKycAtom(key));
  const setAmount = useAtomSet(setPositionDetailsStakeAmountAtom(key));
  const setMaxAmount = useAtomSet(setPositionDetailsStakeMaxAmountAtom(key));
  const setTronResource = useAtomSet(
    setPositionDetailsStakeTronResourceAtom(key)
  );
  const submit = useAtomSet(submitPositionDetailsStakeAtom(key));
  const selectToken = useAtomSet(selectPositionDetailsStakeTokenAtom(key));
  const revealTokenBalance = useAtomSet(
    revealPositionDetailsStakeTokenBalanceAtom(key)
  );
  const hideTokenBalance = useAtomSet(
    hidePositionDetailsStakeTokenBalanceAtom(key)
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
