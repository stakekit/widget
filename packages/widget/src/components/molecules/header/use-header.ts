import { Maybe } from "purify-ts";
import { useMemo } from "react";
import { useNavigate } from "react-router";
import { shouldShowDisconnect } from "../../../domain/types/connectors";
import { useDetailsMatch } from "../../../hooks/navigation/use-details-match";
import { useTrackEvent } from "../../../hooks/tracking/use-track-event";
import { useLogout } from "../../../hooks/use-logout";
import { useSettings } from "../../../providers/settings";
import { useSKWallet } from "../../../providers/sk-wallet";
import { useWagmiConfig } from "../../../providers/wagmi";
import { useSyncHeaderHeight } from "./use-sync-header-height";

export const useHeader = () => {
  const navigate = useNavigate();

  const { containerRef } = useSyncHeaderHeight();

  const { variant, hideChainSelector, hideAccountAndChainSelector } =
    useSettings();

  const { isConnected, isConnecting, connector } = useSKWallet();

  const showDisconnect = useMemo(
    () =>
      Maybe.fromNullable(connector).map(shouldShowDisconnect).orDefault(false),
    [connector]
  );

  const wagmiConfig = useWagmiConfig();

  const showBack = !useDetailsMatch();

  const trackEvent = useTrackEvent();

  const onLeftIconPress = () => {
    if (!showBack) return;

    trackEvent("backClicked");
    navigate(-1);
  };

  const { mutate: logout } = useLogout();

  const onXPress = () => {
    trackEvent("widgetDisconnectClicked");
    logout();
  };

  return {
    onLeftIconPress,
    onXPress,
    containerRef,
    wagmiConfig,
    variant,
    hideChainSelector,
    isConnected,
    isConnecting,
    showDisconnect,
    showBack,
    hideAccountAndChainSelector,
  };
};
