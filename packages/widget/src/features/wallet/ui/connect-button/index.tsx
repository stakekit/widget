import { useAtomSet } from "@effect/atom-react";
import { useConnectModal } from "@stakekit/rainbowkit";
import type { ComponentProps } from "react";
import { useTranslation } from "react-i18next";
import { isLedgerLiveConnector } from "../../../../services/wallet/connectors/ledger/ledger-live-connector-meta";
import { Button } from "../../../../shared/ui/primitives/button";
import { useTrackEvent } from "../../../tracking/react/use-track-event";
import { useSKWallet } from "../../react/use-wallet";
import { addLedgerAccountAtom } from "../../state/workflows";

export const ConnectButton = (props: ComponentProps<typeof Button>) => {
  const { t } = useTranslation();

  const { isLedgerLiveAccountPlaceholder, chain, connector } = useSKWallet();
  const addLedgerAccount = useAtomSet(addLedgerAccountAtom);

  const { openConnectModal } = useConnectModal();

  const trackEvent = useTrackEvent();

  const onClick = () => {
    if (isLedgerLiveAccountPlaceholder && chain) {
      trackEvent("addLedgerAccountClicked");
      return addLedgerAccount({
        chain,
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
