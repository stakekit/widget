import { useAtomSet } from "@effect/atom-react";
import { Option } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { shouldShowDisconnect } from "../../../services/wallet/wallet-connectors";
import { useLeaveConfirmation } from "../../leave-confirmation/index";
import { useWidgetNavigate } from "../../navigation/index";
import { useTrackEvent } from "../../tracking/index";
import { useSKWallet, useWalletConfig } from "../../wallet/index";
import { useWidgetConfig } from "../../widget-configuration/index";
import { disconnectWidgetAtom } from "../state/disconnect-widget";
import { headerElementAtom } from "../state/layout-height";
import { useDetailsMatch } from "./use-details-match";
import { useElementAtomRef } from "./use-element-atom-ref";

export const useHeader = () => {
  const navigation = useWidgetNavigate();

  const headerRef = useElementAtomRef(headerElementAtom);

  const { hidesHeaderWalletControl } = useWidgetConfig("hostProfile");
  const hideChainSelector = useWidgetConfig("hideChainSelector");
  const hideAccountAndChainSelector = useWidgetConfig(
    "hideAccountAndChainSelector"
  );

  const wallet = useSKWallet();
  const isConnected = wallet?.status === "connected";
  const isConnecting = wallet?.status === "connecting";
  const connector = wallet?.network ? wallet.connector : null;

  const showDisconnect = connector ? shouldShowDisconnect(connector) : false;

  const walletConfig = useWalletConfig();
  const walletConfigReady = Option.isSome(AsyncResult.value(walletConfig));

  const showBack = !useDetailsMatch();

  const trackEvent = useTrackEvent();

  const onLeftIconPress = () => {
    if (!showBack) return;

    trackEvent("backClicked");
    navigation.back();
  };

  const disconnectWidget = useAtomSet(disconnectWidgetAtom);
  const leaveConfirmation = useLeaveConfirmation();

  const onXPress = () =>
    leaveConfirmation.confirm(() => {
      trackEvent("widgetDisconnectClicked");
      disconnectWidget(undefined);
    });

  return {
    onLeftIconPress,
    onXPress,
    headerRef,
    leaveConfirmationDialog: leaveConfirmation.dialog,
    walletConfigReady,
    hidesHeaderWalletControl,
    hideChainSelector,
    isConnected,
    isConnecting,
    showDisconnect,
    showBack,
    hideAccountAndChainSelector,
  };
};
