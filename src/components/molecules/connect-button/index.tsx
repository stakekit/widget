import { useTranslation } from "react-i18next";
import { Button } from "../../atoms/button";
import { ComponentProps } from "react";
import { useConnectModal } from "@stakekit/rainbowkit";
import { useTrackEvent } from "../../../hooks/tracking/use-track-event";

export const ConnectButton = (props: ComponentProps<typeof Button>) => {
  const { t } = useTranslation();

  const { openConnectModal } = useConnectModal();

  const trackEvent = useTrackEvent();

  const onClick = () => {
    trackEvent("connectWalletClicked");
    openConnectModal?.();
  };

  return (
    <Button onClick={onClick} {...props}>
      {t("init.connect_wallet")}
    </Button>
  );
};
