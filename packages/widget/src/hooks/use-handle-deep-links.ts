import { useEffect } from "react";
import { useNavigate } from "react-router";
import { usePendingActionDeepLink } from "../pages/details/earn-page/state/use-pending-action-deep-link";
import { useMountAnimation } from "../providers/mount-animation";
import { useSetPendingActionRequest } from "../providers/pending-action-store";
import { useSKWallet } from "../providers/wallet/react/use-wallet";
import { useInitQueryParams } from "./use-init-query-params";
import { useSavedRef } from "./use-saved-ref";

export const useHandleDeepLinks = () => {
  const pendingActionDeepLinkCheck = usePendingActionDeepLink();
  const navigateRef = useSavedRef(useNavigate());
  const setPendingActionRequest = useSetPendingActionRequest();
  const initQueryParams = useInitQueryParams();

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
      setPendingActionRequest({
        actionDto: null,
        requestDto: data.pendingActionDto.requestDto,
        addresses: {
          address: data.pendingActionDto.address,
          additionalAddresses: data.pendingActionDto.additionalAddresses,
        },
        gasFeeToken: data.pendingActionDto.gasFeeToken,
        integrationData: data.pendingActionDto.integrationData,
        interactedToken: data.balance.token,
        pendingActionType: data.pendingActionDto.requestDto.action,
      });
      navigateRef.current(
        `positions/${data.yieldOp.id}/${data.balanceId}/pending-action/review`
      );
    }
  }, [
    setPendingActionRequest,
    pendingActionDeepLinkCheck.data,
    appReady,
    navigateRef,
  ]);
};
