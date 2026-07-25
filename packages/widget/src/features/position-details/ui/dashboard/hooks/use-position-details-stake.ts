import { useAtomSet, useAtomValue } from "@effect/atom-react";
import type { YieldId } from "../../../../../domain/schema/identifiers";
import { useWalletScopeRoute } from "../../../../wallet/ui";
import { usePositionDetailsStakeMatch } from "../../../react/use-position-details-stake-match";
import {
  positionDetailsStakeViewAtom,
  refreshPositionDetailsStakeKycAtom,
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
  const positionDetails = usePositionDetails();

  return {
    ...view,
    kycGate: view.kyc.gate,
    kycGateIsChecking: view.kyc.isChecking,
    kycProviderName: view.kyc.providerName,
    onKycStatusRefresh: () => refreshKyc(undefined),
    onMaxClick: () => setMaxAmount(undefined),
    onPrimaryAction: () => submit(undefined),
    onStakeAmountChange: setAmount,
    onTronResourceSelect: setTronResource,
    positionDetails,
  };
};
