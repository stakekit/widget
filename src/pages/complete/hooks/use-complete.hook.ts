import { useLocation, useNavigate } from "react-router-dom";
import { useTrackEvent } from "../../../hooks/tracking/use-track-event";
import type { TransactionType } from "@stakekit/api-hooks";
import { useUnstakeMatch } from "../../../hooks/navigation/use-unstake-match";
import { usePendingActionMatch } from "../../../hooks/navigation/use-pending-action-match";
import { useRegisterFooterButton } from "../../components/footer-outlet/context";
import { useMemo } from "react";
import { useSavedRef } from "../../../hooks";
import { useTranslation } from "react-i18next";
import { MaybeWindow } from "../../../utils/maybe-window";

export const useComplete = () => {
  const navigate = useNavigate();

  const location = useLocation();

  const urls: {
    type: TransactionType;
    url: string;
  }[] = location.state?.urls ?? [];

  const trackEvent = useTrackEvent();

  const onClick = () => {
    navigate("/");
  };

  const onViewTransactionClick = (url: string) =>
    MaybeWindow.ifJust((w) => {
      trackEvent("viewTxClicked");

      w.open(url, "_blank");
    });

  const unstakeMatch = useUnstakeMatch();
  const pendingActionMatch = usePendingActionMatch();

  const onClickRef = useSavedRef(onClick);

  const { t } = useTranslation();

  useRegisterFooterButton(
    useMemo(
      () => ({
        disabled: false,
        isLoading: false,
        label: t("shared.ok"),
        onClick: () => onClickRef.current(),
      }),
      [onClickRef, t]
    )
  );

  return {
    urls,
    unstakeMatch,
    pendingActionMatch,
    onViewTransactionClick,
  };
};
