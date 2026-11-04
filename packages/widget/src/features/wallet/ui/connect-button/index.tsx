import { useAtomSet } from "@effect/atom-react";
import type { ComponentProps } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../../../../ui/index";
import { useTrackEvent } from "../../../tracking/index";
import { useSKWallet } from "../../react/use-wallet";
import { setWalletConnectModalOpenAtom } from "../../state/wallet-modal";
import { addLedgerAccountAtom } from "../../state/workflows";

/** The primary call to action that connects a wallet or adds a Ledger account. */
export const ConnectButton = ({
  size = "cta",
  ...props
}: Omit<ComponentProps<typeof Button>, "onClick" | "children" | "variant">) => {
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
    <Button {...props} variant="primary" size={size} onClick={onClick}>
      {t(
        isLedgerLiveAccountPlaceholder
          ? "init.ledger_add_account"
          : "init.connect_wallet"
      )}
    </Button>
  );
};
