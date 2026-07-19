import { useMemo } from "react";
import { useNavigate } from "react-router";
import { useWidgetConfig } from "../../../app/config";
import { shouldShowDisconnect } from "../../../domain/types/connectors";
import { useDetailsMatch } from "../../../shared/react/navigation/use-details-match";
import { useTrackEvent } from "../../tracking";
import { useLogout, useSKWallet, useWalletConfig } from "../../wallet";
import { useSyncHeaderHeight } from "./use-sync-header-height";

export const useHeader = () => {
  const navigate = useNavigate();

  const { containerRef } = useSyncHeaderHeight();

  const variant = useWidgetConfig("variant");
  const hideChainSelector = useWidgetConfig("hideChainSelector");
  const hideAccountAndChainSelector = useWidgetConfig(
    "hideAccountAndChainSelector"
  );

  const { isConnected, isConnecting, connector } = useSKWallet();

  const showDisconnect = useMemo(
    () => (connector ? shouldShowDisconnect(connector) : false),
    [connector]
  );

  const walletConfig = useWalletConfig();

  const showBack = !useDetailsMatch();

  const trackEvent = useTrackEvent();

  const onLeftIconPress = () => {
    if (!showBack) return;

    trackEvent("backClicked");
    navigate(-1);
  };

  const logout = useLogout();

  const onXPress = () => {
    trackEvent("widgetDisconnectClicked");
    void logout().catch(() => undefined);
  };

  return {
    onLeftIconPress,
    onXPress,
    containerRef,
    walletConfig,
    variant,
    hideChainSelector,
    isConnected,
    isConnecting,
    showDisconnect,
    showBack,
    hideAccountAndChainSelector,
  };
};
