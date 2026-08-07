import { useAtomSet } from "@effect/atom-react";
import { Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { useMemo } from "react";
import { useNavigate } from "react-router";
import { useWidgetConfig } from "../../../app/config/use-widget-config";
import { shouldShowDisconnect } from "../../../domain/types/connectors";
import { useTrackEvent } from "../../tracking/state";
import { useSKWallet, useWalletConfig } from "../../wallet/state";
import { useDetailsMatch } from "../react/use-details-match";
import { disconnectWidgetAtom } from "../state";
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
  const walletConfigReady = Option.isSome(AsyncResult.value(walletConfig));

  const showBack = !useDetailsMatch();

  const trackEvent = useTrackEvent();

  const onLeftIconPress = () => {
    if (!showBack) return;

    trackEvent("backClicked");
    navigate(-1);
  };

  const disconnectWidget = useAtomSet(disconnectWidgetAtom);

  const onXPress = () => {
    trackEvent("widgetDisconnectClicked");
    disconnectWidget(undefined);
  };

  return {
    onLeftIconPress,
    onXPress,
    containerRef,
    walletConfigReady,
    variant,
    hideChainSelector,
    isConnected,
    isConnecting,
    showDisconnect,
    showBack,
    hideAccountAndChainSelector,
  };
};
