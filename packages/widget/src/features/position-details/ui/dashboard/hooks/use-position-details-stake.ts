import { useAtomSet, useAtomValue } from "@effect/atom-react";
import type { YieldId } from "../../../../../domain/identity/identifiers";
import { useWalletScopeRoute } from "../../../../wallet/index";
import { usePositionDetailsStakeMatch } from "../../../react/use-position-details-stake-match";
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
} from "../../../state/dashboard-stake-facade";
import { PositionDetailsStakeEntryKey } from "../../../state/dashboard-stake-machine";
import { usePositionDetails } from "../../classic/hooks/use-position-details";

export const usePositionDetailsStake = () => {
  const walletScope = useWalletScopeRoute();
  const match = usePositionDetailsStakeMatch();
  const key = new PositionDetailsStakeEntryKey({
    balanceId: match?.params.balanceId ?? "",
    integrationId: (match?.params.integrationId ?? "") as YieldId,
    walletScope,
  });
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
