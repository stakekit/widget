import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { shouldShowDisconnect } from "../../../../services/wallet/wallet-connectors";
import { formatAddress } from "../../../../shared/lib/general";
import {
  Icon,
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
        <Stack align="center">
          <TokenAvatar account={wallet.address} size="xl" />
        </Stack>
        {otherAccounts.length > 0 && (
          <ListGroup>
            {otherAccounts.map((account) => (
              <ListRow
                key={account.address}
                testId={`wallet-account-${account.address}`}
                leading={<TokenAvatar account={account.address} size="sm" />}
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
        <ListGroup>
          <ListRow
            testId="wallet-account-copy"
            leading={<Icon name={copied ? "CheckIcon" : "CopyIcon"} />}
            title={t(
              copied ? "wallet_modal.copied" : "wallet_modal.copy_address"
            )}
            onClick={() => copyAddress(undefined)}
          />
          {showDisconnect && (
            <ListRow
              testId="wallet-account-disconnect"
              leading={<Icon name="DisconnectIcon" />}
              title={t("wallet_modal.disconnect")}
              onClick={() =>
                leaveConfirmation.confirm(() => {
                  setOpen(false);
                  logout();
                })
              }
            />
          )}
        </ListGroup>
        <VisuallyHidden role="status">
          {copied ? t("wallet_modal.copied") : ""}
        </VisuallyHidden>
      </Modal>
      <LeaveConfirmationDialog {...leaveConfirmation.dialog} />
    </>
  );
};
