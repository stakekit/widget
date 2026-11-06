import { useAtomSet } from "@effect/atom-react";
import type { ComponentProps } from "react";
import { useTranslation } from "react-i18next";

import { Button, EmptyState } from "../../../../ui/index";
import { useTrackEvent } from "../../../tracking/index";
import { useWidgetConfig } from "../../../widget-configuration/index";
import { useSKWallet } from "../../react/use-wallet";
import { setWalletConnectModalOpenAtom } from "../../state/wallet-modal";
import { addLedgerAccountAtom } from "../../state/workflows";

/**
 * What connecting a wallet takes from here: its label and what a click does,
 * opening the connect dialog or adding a Ledger account.
 */
const useConnectWalletAction = (): {
  readonly label: string;
  readonly onClick: () => void;
} => {
  const { t } = useTranslation();
  const wallet = useSKWallet();
  const isLedgerLiveAccountPlaceholder =
    wallet?.isLedgerLiveAccountPlaceholder ?? false;
  const chain = wallet?.chain;
  const addLedgerAccount = useAtomSet(addLedgerAccountAtom);
  const setConnectOpen = useAtomSet(setWalletConnectModalOpenAtom);
  const trackEvent = useTrackEvent();

  return {
    label: t(
      isLedgerLiveAccountPlaceholder
        ? "init.ledger_add_account"
        : "init.connect_wallet"
    ),
    onClick: () => {
      if (isLedgerLiveAccountPlaceholder && chain) {
        trackEvent("addLedgerAccountClicked");
        addLedgerAccount({ chain });
        return;
      }

      trackEvent("connectWalletClicked");
      setConnectOpen(true);
    },
  };
};

/** The primary call to action that connects a wallet or adds a Ledger account. */
export const ConnectButton = ({
  size = "cta",
  ...props
}: Omit<ComponentProps<typeof Button>, "onClick" | "children" | "variant">) => {
  const action = useConnectWalletAction();

  return (
    <Button {...props} variant="primary" size={size} onClick={action.onClick}>
      {action.label}
    </Button>
  );
};

/**
 * Stands in for what a section shows once a wallet is connected, such as
 * positions or activity: a wallet spot, `title`, and the connect action,
 * which a host that connects through its External Provider does not get.
 */
export const ConnectWalletState = ({
  title,
  testId,
}: {
  readonly title: string;
  readonly testId?: string;
}) => {
  const action = useConnectWalletAction();
  const externalProviders = useWidgetConfig("externalProviders");

  return (
    <EmptyState
      fill
      icon="WalletIcon"
      title={title}
      {...(testId === undefined ? {} : { testId })}
      {...(externalProviders ? {} : { action })}
    />
  );
};
