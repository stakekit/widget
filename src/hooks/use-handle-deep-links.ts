import { useEffect } from "react";
import { usePendingActionDeepLink } from "../state/stake/use-pending-action-deep-link";
import { Maybe } from "purify-ts";
import { useNavigate } from "react-router-dom";
import { useSavedRef } from "./use-saved-ref";

export const useHandleDeepLinks = () => {
  const pendindActionDeepLinkCheck = usePendingActionDeepLink();
  const navigateRef = useSavedRef(useNavigate());

  useEffect(() => {
    Maybe.fromNullable(pendindActionDeepLinkCheck.data).ifJust((val) => {
      // Pending action constructed, navigate to review
      if (val.type === "review") {
        navigateRef.current(
          `pending-action/${val.pendingActionRes.integrationId}/${val.balanceId}/review`
        );
      } else {
        // Select validator addresses before continuing pending action flow
        navigateRef.current(
          `positions/${val.yieldOp.id}/${val.balanceId}/${val.pendingAction.type}`
        );
      }
    });
  }, [navigateRef, pendindActionDeepLinkCheck.data]);
};
