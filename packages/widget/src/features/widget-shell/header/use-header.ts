import { useAtomSet } from "@effect/atom-react";
import { Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { useMemo } from "react";
import { useNavigate } from "react-router";
import { useWidgetConfig } from "../../../features/widget-configuration/index";
import { shouldShowDisconnect } from "../../../services/wallet/wallet-connectors";
import { useTrackEvent } from "../../tracking/index";
import { useSKWallet, useWalletConfig } from "../../wallet/index";
import { useDetailsMatch } from "../react/use-details-match";
import { useElementAtomRef } from "../react/use-element-atom-ref";
import { disconnectWidgetAtom } from "../state/disconnect-widget";
import { headerElementAtom } from "../state/layout-height";

export const useHeader = () => {
  const navigate = useNavigate();

  const headerRef = useElementAtomRef(headerElementAtom);

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
    headerRef,
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
