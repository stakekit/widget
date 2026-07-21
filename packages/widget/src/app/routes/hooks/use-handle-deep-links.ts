import { useAtomValue } from "@effect/atom-react";
import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useStartClassicTransactionFlow } from "../../../features/classic-transaction-flow/react/use-transaction-flow";
import { getProvidersDetails } from "../../../features/earn/react/use-provider-details";
import { usePendingActionDeepLink } from "../../../features/earn/ui/classic/earn-page/state/use-pending-action-deep-link";
import { initParamsAtom } from "../../../features/init-params/atoms";
import { useMountAnimation } from "../../../features/mount-animation/react/use-mount-animation";
import { useSKWallet } from "../../../features/wallet/react/use-wallet";
import { useSavedRef } from "../../../shared/react/use-saved-ref";

export const useHandleDeepLinks = () => {
  const pendingActionDeepLinkCheck = usePendingActionDeepLink();
  const navigateRef = useSavedRef(useNavigate());
  const startClassicTransactionFlow = useStartClassicTransactionFlow();
  const initQueryParams = useAtomValue(initParamsAtom);

  const { mountAnimationFinished } = useMountAnimation();
  const { isConnected } = useSKWallet();

  const appReady = mountAnimationFinished && isConnected;

  // Position details page
  useEffect(() => {
    if (
      initQueryParams?.yieldId &&
      initQueryParams.balanceId &&
      !initQueryParams.pendingaction &&
      appReady
    ) {
      navigateRef.current(
        `positions/${initQueryParams.yieldId}/${initQueryParams.balanceId}`
      );
    }
  }, [initQueryParams, navigateRef, appReady]);

  // Select validators on position details page
  useEffect(() => {
    const data = pendingActionDeepLinkCheck.data;

    if (appReady && data?.type === "positionDetails") {
      navigateRef.current(
        `positions/${data.yieldOp.id}/${data.balanceId}/select-validator/${data.pendingAction.type}`
      );
    }
  }, [navigateRef, pendingActionDeepLinkCheck.data, appReady]);

  // Review pending action
  useEffect(() => {
    const data = pendingActionDeepLinkCheck.data;
    if (appReady && data?.type === "review") {
      startClassicTransactionFlow({
        _tag: "Manage",
        request: data.pendingActionDto.requestDto,
        gasFeeToken: data.pendingActionDto.gasFeeToken,
        integration: data.pendingActionDto.integrationData,
        interactedToken: data.balance.token,
        pendingActionType: data.pendingActionDto.requestDto.action,
        providersDetails:
          getProvidersDetails({
            integrationData: data.pendingActionDto.integrationData,
            validators: [],
            yields: null,
            selectedProviderYieldId: null,
          }) ?? [],
        walletScope: data.walletScope,
      });
      navigateRef.current(
        `positions/${data.yieldOp.id}/${data.balanceId}/pending-action/review`
      );
    }
  }, [
    startClassicTransactionFlow,
    pendingActionDeepLinkCheck.data,
    appReady,
    navigateRef,
  ]);
};
