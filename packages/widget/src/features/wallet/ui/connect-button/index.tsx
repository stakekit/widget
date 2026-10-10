import { useAtomSet } from "@effect/atom-react";
import type { ComponentProps } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../../../../shared/ui/primitives/button";
import { useTrackEvent } from "../../../tracking/index";
import { useSKWallet } from "../../react/use-wallet";
import { setWalletConnectModalOpenAtom } from "../../state/wallet-modal";
import { addLedgerAccountAtom } from "../../state/workflows";

export const ConnectButton = (props: ComponentProps<typeof Button>) => {
  const { t } = useTranslation();

  const wallet = useSKWallet();
  const isLedgerLiveAccountPlaceholder =
    wallet?.isLedgerLiveAccountPlaceholder ?? false;
  const chain = wallet?.chain;
  const addLedgerAccount = useAtomSet(addLedgerAccountAtom);
  const setConnectOpen = useAtomSet(setWalletConnectModalOpenAtom);

  const trackEvent = useTrackEvent();

  const onClick = () => {
    if (isLedgerLiveAccountPlaceholder && chain) {
      trackEvent("addLedgerAccountClicked");
      return addLedgerAccount({ chain });
    }

    trackEvent("connectWalletClicked");
    setConnectOpen(true);
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
