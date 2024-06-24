import { useUpdateEffect } from "@sk-widget/hooks/use-update-effect";
import { usePendingActionDeepLink } from "@sk-widget/pages/details/earn-page/state/use-pending-action-deep-link";
import {
  usePendingActionDispatch,
  usePendingActionState,
} from "@sk-widget/providers/pending-action-state";
import { Maybe } from "purify-ts";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSavedRef } from "./use-saved-ref";

export const useHandleDeepLinks = () => {
  const pendingActionDeepLinkCheck = usePendingActionDeepLink();
  const navigateRef = useSavedRef(useNavigate());
  const pendingActionState = usePendingActionState();
  const pendignActionRequestDispatch = usePendingActionDispatch();

  // Select validators on position details page
  useEffect(() => {
    Maybe.fromNullable(pendingActionDeepLinkCheck.data).ifJust((val) => {
      if (val.type === "positionDetails") {
        navigateRef.current(
          `positions/${val.yieldOp.id}/${val.balanceId}/select-validator/${val.pendingAction.type}`
        );
      }
    });
  }, [navigateRef, pendingActionDeepLinkCheck.data]);

  // Review pending action
  useEffect(() => {
    Maybe.fromNullable(pendingActionDeepLinkCheck.data).ifJust((val) => {
      if (val.type === "review") {
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
        );
      }
    });
  }, [pendignActionRequestDispatch, pendingActionDeepLinkCheck.data]);

  useUpdateEffect(() => {
    pendingActionState.ifJust(() => {
      if (
        pendingActionDeepLinkCheck.data?.type === "review" &&
        pendingActionState.isJust()
      ) {
        navigateRef.current(
          `positions/${pendingActionDeepLinkCheck.data.yieldOp.id}/${pendingActionDeepLinkCheck.data.balanceId}/pending-action/review`
        );
      }
    });
  }, [pendingActionState, pendingActionDeepLinkCheck.data]);
};
