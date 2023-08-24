import { useTranslation } from "react-i18next";
import { Button } from "../../atoms/button";
import { ComponentProps } from "react";
import { useConnectModal } from "@stakekit/rainbowkit";

export const ConnectButton = (props: ComponentProps<typeof Button>) => {
  const { t } = useTranslation();

  const { openConnectModal } = useConnectModal();

  const onClick = () => openConnectModal?.();

  return (
    <Button onClick={onClick} {...props}>
      {t("init.connect_wallet")}
    </Button>
  );
};
