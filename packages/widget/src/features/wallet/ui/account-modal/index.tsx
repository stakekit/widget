import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { shouldShowDisconnect } from "../../../../services/wallet/wallet-connectors";
import { formatAddress } from "../../../../shared/lib/general";
import {
  Button,
  ListGroup,
  ListRow,
  Modal,
  Stack,
  TokenAvatar,
  TokenTrigger,
  VisuallyHidden,
} from "../../../../ui/index";
import { useLeaveConfirmation } from "../../../leave-confirmation/index";
import { LeaveConfirmationDialog } from "../../../leave-confirmation/views";
import { useTrackEvent } from "../../../tracking/index";
import { useSKWallet } from "../../react/use-wallet";
import { getOtherAccounts } from "../../state/account-identities";
import {
  copyWalletAddressAtom,
  walletAddressCopiedAtom,
} from "../../state/account-presentation";
import { logoutAtom, switchAccountAtom } from "../../state/workflows";

export const AccountModal = () => {
  const { t } = useTranslation();
  const trackEvent = useTrackEvent();
  const wallet = useSKWallet();
  const [isOpen, setOpen] = useState(false);
  const logout = useAtomSet(logoutAtom);
  const switchAccount = useAtomSet(switchAccountAtom);
  const copyAddress = useAtomSet(copyWalletAddressAtom);
  const copied = useAtomValue(walletAddressCopiedAtom);
  const leaveConfirmation = useLeaveConfirmation();

  // A connecting wallet keeps its scope owner while a network switch settles.
  if (!wallet?.network) return null;

  const otherAccounts = getOtherAccounts({
    accounts: wallet.ledgerAccounts,
    currentAddress: wallet.address,
    network: wallet.network,
  });
  const displayAddress = formatAddress(wallet.address);
  const showDisconnect = shouldShowDisconnect(wallet.connector);

  return (
    <>
      <TokenTrigger
        hostHook="account-modal-container"
        token={{ name: displayAddress }}
        account={wallet.address}
        onClick={() => {
          trackEvent("accountModalOpened");
          setOpen(true);
        }}
      />

      <Modal
        open={isOpen}
        onOpenChange={setOpen}
        suspended={leaveConfirmation.pending}
        testId="wallet-account-dialog"
        title={displayAddress}
        closeLabel={t("wallet_modal.close")}
      >
        <Stack align="center" gap={16}>
          <TokenAvatar account={wallet.address} size="lg" />
          <Stack direction="row" justify="center" gap={8} wrap>
            <Button
              testId="wallet-account-copy"
              iconStart={copied ? "CheckIcon" : "CopyIcon"}
              onClick={() => copyAddress(undefined)}
            >
              {t(copied ? "wallet_modal.copied" : "wallet_modal.copy_address")}
            </Button>
            {showDisconnect && (
              <Button
                testId="wallet-account-disconnect"
                iconStart="DisconnectIcon"
                onClick={() =>
                  leaveConfirmation.confirm(() => {
                    setOpen(false);
                    logout();
                  })
                }
              >
                {t("wallet_modal.disconnect")}
              </Button>
            )}
          </Stack>
        </Stack>
        {otherAccounts.length > 0 && (
          <ListGroup density="condensed">
            {otherAccounts.map((account) => (
              <ListRow
                key={account.address}
                testId={`wallet-account-${account.address}`}
                leading={
                  <TokenAvatar account={account.address} size="control" />
                }
                title={formatAddress(account.address)}
                onClick={() =>
                  leaveConfirmation.confirm(() => {
                    switchAccount({ account, connector: wallet.connector });
                    setOpen(false);
                  })
                }
              />
            ))}
          </ListGroup>
        )}
        <VisuallyHidden role="status">
          {copied ? t("wallet_modal.copied") : ""}
        </VisuallyHidden>
      </Modal>
      <LeaveConfirmationDialog {...leaveConfirmation.dialog} />
    </>
  );
};
