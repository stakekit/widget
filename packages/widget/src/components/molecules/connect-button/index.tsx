import { useConnectModal } from "@stakekit/rainbowkit";
import type { ComponentProps } from "react";
import { useTranslation } from "react-i18next";
import { useTrackEvent } from "../../../hooks/tracking/use-track-event";
import { useAddLedgerAccount } from "../../../hooks/use-add-ledger-account";
import { useSKWallet } from "../../../providers/sk-wallet";
import { Button } from "../../atoms/button";

export const ConnectButton = (props: ComponentProps<typeof Button>) => {
  const { t } = useTranslation();

  const { isLedgerLiveAccountPlaceholder, chain } = useSKWallet();

  const addLedgerAccount = useAddLedgerAccount();

  const { openConnectModal } = useConnectModal();

  const trackEvent = useTrackEvent();

  const onClick = () => {
    if (isLedgerLiveAccountPlaceholder && chain) {
      trackEvent("addLedgerAccountClicked");
      return addLedgerAccount.mutate(chain);
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
