import { useAtomValue } from "@effect/atom-react";
import { useEffect } from "react";
import { useNavigate } from "react-router";
import { usePendingActionDeepLink } from "../../../features/earn/support";
import { initParamsAtom } from "../../../features/init-params";
import { useMountAnimation } from "../../../features/mount-animation";
import { useSetPendingActionRequest } from "../../../features/transaction-flow";
import { useSKWallet } from "../../../features/wallet";
import { useSavedRef } from "../../../shared/react/use-saved-ref";

export const useHandleDeepLinks = () => {
  const pendingActionDeepLinkCheck = usePendingActionDeepLink();
  const navigateRef = useSavedRef(useNavigate());
  const setPendingActionRequest = useSetPendingActionRequest();
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
