import { usePendingActionDeepLink } from "@sk-widget/pages/details/earn-page/state/use-pending-action-deep-link";
import { usePendingStakeRequestDtoDispatch } from "@sk-widget/providers/pending-stake-request-dto";
import { Maybe } from "purify-ts";
import { useEffect } from "react";
import { flushSync } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useSavedRef } from "./use-saved-ref";

export const useHandleDeepLinks = () => {
  const pendingActionDeepLinkCheck = usePendingActionDeepLink();
  const navigateRef = useSavedRef(useNavigate());
  const dispatch = usePendingStakeRequestDtoDispatch();

  useEffect(() => {
    Maybe.fromNullable(pendingActionDeepLinkCheck.data).ifJust((val) => {
      // Pending action constructed, navigate to review
      if (val.type === "review") {
        // TODO: Check this!
        flushSync(() => {
          dispatch({
            ...val.pendingActionDto,
            pendingActionData: {
              integrationData: val.yieldOp,
              interactedToken: val.balance.token,
            },
            pendingActionType: Maybe.of(val.pendingActionDto.type),
          });
        });
        navigateRef.current(
          `positions/${val.pendingActionDto.integrationId}/${val.balanceId}/pending-action/review`
        );
      } else {
        // Select validator addresses before continuing pending action flow
        navigateRef.current(
          `positions/${val.yieldOp.id}/${val.balanceId}/select-validator/${val.pendingAction.type}`
        );
      }
    });
  }, [navigateRef, dispatch, pendingActionDeepLinkCheck.data]);
};
