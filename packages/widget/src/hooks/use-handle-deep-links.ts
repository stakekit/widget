import { useInitQueryParams } from "@sk-widget/hooks/use-init-query-params";
import { useUpdateEffect } from "@sk-widget/hooks/use-update-effect";
import { usePendingActionDeepLink } from "@sk-widget/pages/details/earn-page/state/use-pending-action-deep-link";
import { useMountAnimation } from "@sk-widget/providers/mount-animation";
import {
  usePendingActionDispatch,
  usePendingActionState,
} from "@sk-widget/providers/pending-action-state";
import { useSKWallet } from "@sk-widget/providers/sk-wallet";
import { Maybe } from "purify-ts";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSavedRef } from "./use-saved-ref";

export const useHandleDeepLinks = () => {
  const pendingActionDeepLinkCheck = usePendingActionDeepLink();
  const navigateRef = useSavedRef(useNavigate());
  const pendingActionState = usePendingActionState();
  const pendignActionRequestDispatch = usePendingActionDispatch();
  const initQueryParams = useInitQueryParams();

  const { mountAnimationFinished } = useMountAnimation();
  const { isConnected } = useSKWallet();

  const appReady = mountAnimationFinished && isConnected;

  // Position details page
  useEffect(() => {
    initQueryParams
      .filter((val) =>
        Boolean(val.yieldId && val.balanceId && !val.pendingaction && appReady)
      )
      .ifJust((val) =>
        navigateRef.current(`positions/${val.yieldId}/${val.balanceId}`)
      );
  }, [initQueryParams, navigateRef, appReady]);

  // Select validators on position details page
  useEffect(() => {
    Maybe.fromNullable(pendingActionDeepLinkCheck.data)
      .filter(
        (val): val is Extract<typeof val, { type: "positionDetails" }> =>
          appReady && val.type === "positionDetails"
      )
      .ifJust((val) =>
        navigateRef.current(
          `positions/${val.yieldOp.id}/${val.balanceId}/select-validator/${val.pendingAction.type}`
        )
      );
  }, [navigateRef, pendingActionDeepLinkCheck.data, appReady]);

  // Review pending action
  useEffect(() => {
    Maybe.fromNullable(pendingActionDeepLinkCheck.data)
      .filter(
        (val): val is Extract<typeof val, { type: "review" }> =>
          appReady && val.type === "review"
      )
      .ifJust((val) =>
        pendignActionRequestDispatch(
          Maybe.of({
            actionDto: Maybe.empty(),
            requestDto: val.pendingActionDto.requestDto,
            addresses: {
              address: val.pendingActionDto.address,
              additionalAddresses: val.pendingActionDto.additionalAddresses,
            },
            gasFeeToken: val.pendingActionDto.gasFeeToken,
            integrationData: val.pendingActionDto.integrationData,
            interactedToken: val.balance.token,
            pendingActionType: val.pendingActionDto.requestDto.type,
          })
        )
      );
  }, [pendignActionRequestDispatch, pendingActionDeepLinkCheck.data, appReady]);

  useUpdateEffect(() => {
    pendingActionState
      .chainNullable(() => pendingActionDeepLinkCheck.data)
      .filter(() => appReady)
      .ifJust((val) =>
        navigateRef.current(
          `positions/${val.yieldOp.id}/${val.balanceId}/pending-action/review`
        )
      );
  }, [pendingActionState, pendingActionDeepLinkCheck.data, appReady]);
};
