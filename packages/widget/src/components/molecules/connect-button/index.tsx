import { useAtomSet } from "@effect/atom-react";
import { useConnectModal } from "@stakekit/rainbowkit";
import type { ComponentProps } from "react";
import { useTranslation } from "react-i18next";
import { addLedgerAccountAtom } from "../../../atoms/wallet-workflows";
import { useTrackEvent } from "../../../hooks/tracking/use-track-event";
import { useCloseChainModal } from "../../../hooks/use-close-chain-modal";
import { isLedgerLiveConnector } from "../../../providers/ledger/ledger-live-connector-meta";
import { useSKWallet } from "../../../providers/wallet/react/use-wallet";
import { Button } from "../../atoms/button";

export const ConnectButton = (props: ComponentProps<typeof Button>) => {
  const { t } = useTranslation();

  const { isLedgerLiveAccountPlaceholder, chain, connector } = useSKWallet();
  const addLedgerAccount = useAtomSet(addLedgerAccountAtom);
  const { closeChainModal } = useCloseChainModal();

  const { openConnectModal } = useConnectModal();

  const trackEvent = useTrackEvent();

  const onClick = () => {
    if (isLedgerLiveAccountPlaceholder && chain) {
      trackEvent("addLedgerAccountClicked");
      return addLedgerAccount({
        chain,
        closeChainModal,
        connector:
          connector && isLedgerLiveConnector(connector) ? connector : null,
      });
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
