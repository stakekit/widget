import { useTranslation } from "react-i18next";
import { Button } from "../../atoms/button";
import { ComponentProps } from "react";
import { useConnectModal } from "@stakekit/rainbowkit";
import { useTrackEvent } from "../../../hooks/tracking/use-track-event";
import { useSKWallet } from "../../../providers/sk-wallet";
import { useAddLedgerAccount } from "../../../hooks/use-add-ledger-account";

export const ConnectButton = (props: ComponentProps<typeof Button>) => {
  const { t } = useTranslation();

  const { isLedgerLiveAccountPlaceholder, chain } = useSKWallet();

  const addLedgerAccount = useAddLedgerAccount();

  const { openConnectModal } = useConnectModal();

  const trackEvent = useTrackEvent();

  const onClick = () => {
    if (isLedgerLiveAccountPlaceholder && chain) {
      trackEvent("addLedgerAccountClicked");
      return addLedgerAccount.mutateAsync(chain);
    }

    trackEvent("connectWalletClicked");
    openConnectModal?.();
  };

  return (
    <Button onClick={onClick} {...props}>
      {t(
        isLedgerLiveAccountPlaceholder
          ? "init.ledger_add_account"
          : "init.connect_wallet"
      )}
    </Button>
  );
};
