import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { useEffect } from "react";
import { useNavigate } from "react-router";
import { initParamsAtom } from "../../../features/init-params/atoms";
import { useMountAnimation } from "../../../features/mount-animation/react/use-mount-animation";
import { useSKWallet } from "../../../features/wallet/react/use-wallet";
import { useSavedRef } from "../../../shared/react/use-saved-ref";
import {
  applyPendingActionDeepLinkNavigationAtom,
  pendingActionDeepLinkRouteAtom,
} from "../state/pending-action-deep-link-route";

export const useHandleDeepLinks = () => {
  const navigateRef = useSavedRef(useNavigate());
  const pendingActionNavigation = useAtomValue(pendingActionDeepLinkRouteAtom);
  const applyPendingActionNavigation = useAtomSet(
    applyPendingActionDeepLinkNavigationAtom
  );
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

  // React Router is the external navigation boundary for claimed outcomes.
  useEffect(() => {
    if (!pendingActionNavigation) return;

    applyPendingActionNavigation({
      epoch: pendingActionNavigation.epoch,
      navigate: navigateRef.current,
    });
  }, [applyPendingActionNavigation, navigateRef, pendingActionNavigation]);
};
