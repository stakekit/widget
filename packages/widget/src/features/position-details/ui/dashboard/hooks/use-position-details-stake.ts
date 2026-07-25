import { useAtomSet, useAtomValue } from "@effect/atom-react";
import type { YieldId } from "../../../../../domain/schema/identifiers";
import { usePositionDetailsStakeMatch } from "../../../../../shared/react/navigation/use-position-details-stake-match";
import { useWalletScopeRoute } from "../../../../wallet/react/wallet-scope-route";
import { usePositionDetails } from "../../classic/hooks/use-position-details";
import {
  positionDetailsStakeViewAtom,
  refreshPositionDetailsStakeKycAtom,
  setPositionDetailsStakeAmountAtom,
  setPositionDetailsStakeMaxAmountAtom,
  setPositionDetailsStakeTronResourceAtom,
  submitPositionDetailsStakeAtom,
} from "../state/stake-facade";
import { PositionDetailsStakeEntryKey } from "../state/stake-machine";

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
