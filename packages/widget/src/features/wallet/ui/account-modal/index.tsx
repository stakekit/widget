import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { explorerAddressUrl } from "../../../../services/evm-rpc/evm-rpc";
import { shouldShowDisconnect } from "../../../../services/wallet/wallet-connectors";
import type { Chain } from "../../../../services/wallet/wallet-descriptors";
import { formatAddress } from "../../../../shared/lib/general";
import { formatTokenAmountWithSymbol } from "../../../../shared/lib/number-format";
import {
  Button,
  Card,
  Divider,
  ExternalLink,
  IconButton,
  ListGroup,
  ListRow,
  Modal,
  Stack,
  Text,
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
  walletGasTokenBalanceAtom,
} from "../../state/account-presentation";
import { logoutAtom, switchAccountAtom } from "../../state/workflows";
import { WalletChainIcon } from "../wallet-dialog/chain-icon";

/**
 * The wallet header's account pill and the account dialog it opens.
 * `triggerSize` sizes the pill to its header's row.
 */
export const AccountModal = ({
  triggerSize,
}: {
  readonly triggerSize: "sm" | "tabs";
}) => {
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
  const explorerUrl = explorerAddressUrl(wallet.chain, wallet.address);
  const actions = [
    ...(explorerUrl === null
      ? []
      : [
          <ExternalLink
            key="explorer"
            href={explorerUrl}
            newTabLabel={t("shared.opens_in_new_tab")}
            button={{ share: true }}
          >
            {t("wallet_modal.view_on_explorer")}
          </ExternalLink>,
        ]),
    ...(shouldShowDisconnect(wallet.connector)
      ? [
          <Button
            key="disconnect"
            testId="wallet-account-disconnect"
            variant="dangerOutline"
            iconStart="DisconnectIcon"
            share
            onClick={() =>
              leaveConfirmation.confirm(() => {
                setOpen(false);
                logout();
              })
            }
          >
            {t("wallet_modal.disconnect")}
          </Button>,
        ]
      : []),
  ];
  // The actions share one row, each on its own line once their labels no
  // longer fit side by side.
  const footer =
    actions.length === 0
      ? {}
      : {
          footer: (
            <Stack direction="row" gap={8} wrap>
              {actions}
            </Stack>
          ),
        };

  return (
    <>
      <TokenTrigger
        hostHook="account-modal-container"
        size={triggerSize}
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
        title={t("wallet_modal.account")}
        closeLabel={t("wallet_modal.close")}
        initialFocus="dialog"
        {...footer}
      >
        <Card>
          <Stack gap={12}>
            <Stack direction="row" align="center" gap={12}>
              <TokenAvatar account={wallet.address} size="card" />
              <Stack grow>
                <Stack direction="row" align="center" gap={8}>
                  <Text variant="heading" as="p" truncate>
                    {displayAddress}
                  </Text>
                  {copied && (
                    <Text variant="caption" tone="success" weight="semibold">
                      {t("wallet_modal.copied")}
                    </Text>
                  )}
                </Stack>
                <Text variant="caption" tone="muted" truncate>
                  {wallet.connector.name}
                </Text>
              </Stack>
              <IconButton
                testId="wallet-account-copy"
                icon={copied ? "CheckIcon" : "CopyIcon"}
                label={t("wallet_modal.copy_address")}
                onClick={() => copyAddress(undefined)}
              />
            </Stack>
            <Divider />
            <AccountConnection chain={wallet.chain} />
          </Stack>
        </Card>
        {otherAccounts.length > 0 && (
          <ListGroup
            density="condensed"
            label={t("wallet_modal.other_accounts")}
          >
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

/**
 * The network the account is connected to, with its gas token balance once
 * known. It mounts with the open dialog, so the balance is read only while
 * it shows.
 */
const AccountConnection = ({ chain }: { readonly chain: Chain }) => {
  const { t, i18n } = useTranslation();
  const balance = useAtomValue(walletGasTokenBalanceAtom);

  return (
    <Stack direction="row" align="center" gap={8}>
      <WalletChainIcon chain={chain} size="sm" />
      <Stack grow>
        <Text variant="label" tone="muted" truncate>
          {t("wallet_modal.connected_to", { network: chain.name })}
        </Text>
      </Stack>
      {balance !== null && (
        <Text variant="label" weight="semibold" numeric>
          {formatTokenAmountWithSymbol(balance, i18n.language)}
        </Text>
      )}
    </Stack>
  );
};
