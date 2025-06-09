import { useSyncHeaderHeight } from "@sk-widget/components/molecules/header/use-sync-header-height";
import { shouldShowDisconnect } from "@sk-widget/domain/types/connectors";
import { useDetailsMatch } from "@sk-widget/hooks/navigation/use-details-match";
import { useTrackEvent } from "@sk-widget/hooks/tracking/use-track-event";
import { useLogout } from "@sk-widget/hooks/use-logout";
import { useSettings } from "@sk-widget/providers/settings";
import { useSKWallet } from "@sk-widget/providers/sk-wallet";
import { useWagmiConfig } from "@sk-widget/providers/wagmi";
import { Maybe } from "purify-ts";
import { useMemo } from "react";
import { useNavigate } from "react-router";

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
