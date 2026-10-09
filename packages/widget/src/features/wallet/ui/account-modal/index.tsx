import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Title } from "@radix-ui/react-dialog";
import clsx from "clsx";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useWidgetConfig } from "../../../../features/widget-configuration/index";
import { shouldShowDisconnect } from "../../../../services/wallet/wallet-connectors";
import { formatAddress } from "../../../../shared/lib/general";
import { combineRecipeWithVariant } from "../../../../shared/styles/recipe-variant";
import { Box } from "../../../../shared/ui/primitives/box";
import { CaretDownIcon } from "../../../../shared/ui/primitives/icons/caret-down";
import { Text } from "../../../../shared/ui/primitives/typography/text";
import { useTrackEvent } from "../../../tracking/index";
import { useSKWallet } from "../../react/use-wallet";
import { getOtherAccounts } from "../../state/account-identities";
import {
  copyWalletAddressAtom,
  walletAddressCopiedAtom,
} from "../../state/account-presentation";
import { logoutAtom, switchAccountAtom } from "../../state/workflows";
import { WalletDialog, WalletDialogClose } from "../wallet-dialog";
import { WalletAvatar } from "../wallet-dialog/avatar";
import { CopiedIcon, CopyIcon, DisconnectIcon } from "../wallet-dialog/icons";
import { heading, menuButton } from "../wallet-dialog/styles.css";
import {
  accountOption,
  action,
  actionContent,
  actionIcon,
  actions,
  close,
  container,
  profile,
  profileAvatar,
  profileDetails,
  titleStyle,
  triggerAvatar,
} from "./styles.css";

export const AccountModal = () => {
  const { t } = useTranslation();
  const trackEvent = useTrackEvent();
  const wallet = useSKWallet();
  const variant = useWidgetConfig("variant");
  const [isOpen, setOpen] = useState(false);
  const logout = useAtomSet(logoutAtom);
  const switchAccount = useAtomSet(switchAccountAtom);
  const copyAddress = useAtomSet(copyWalletAddressAtom);
  const copied = AsyncResult.getOrElse(
    useAtomValue(walletAddressCopiedAtom),
    () => false
  );

  if (wallet?.status !== "connected") return null;

  const otherAccounts = getOtherAccounts({
    accounts: wallet.ledgerAccounts,
    currentAddress: wallet.address,
    network: wallet.network,
  });
  const displayAddress = formatAddress(wallet.address);
  const showDisconnect = shouldShowDisconnect(wallet.connector);

  return (
    <>
      <Box
        data-rk="account-modal-container"
        as="button"
        type="button"
        aria-label={displayAddress}
        borderRadius="2xl"
        background="backgroundMuted"
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        className={combineRecipeWithVariant({ variant, rec: container })}
        paddingLeft="2"
        py="2"
        onClick={() => {
          trackEvent("accountModalOpened");
          setOpen(true);
        }}
      >
        <WalletAvatar address={wallet.address} className={triggerAvatar} />
        <Text className={titleStyle}>{displayAddress}</Text>
        <Box mx="2">
          <CaretDownIcon />
        </Box>
      </Box>

      <WalletDialog
        open={isOpen}
        onOpenChange={setOpen}
        testId="wallet-account-dialog"
      >
        <div className={profile}>
          <div className={profileDetails}>
            <div className={close}>
              <WalletDialogClose onClose={() => setOpen(false)} />
            </div>
            <WalletAvatar address={wallet.address} className={profileAvatar} />
            <Title className={heading}>{displayAddress}</Title>
            {otherAccounts.map((account) => (
              <button
                key={account.address}
                type="button"
                className={clsx(menuButton, accountOption)}
                data-testid={`wallet-account-${account.address}`}
                onClick={() => {
                  switchAccount({ account, connector: wallet.connector });
                  setOpen(false);
                }}
              >
                <span className={heading}>
                  {formatAddress(account.address)}
                </span>
              </button>
            ))}
          </div>
          <div className={actions}>
            <button
              type="button"
              className={action}
              onClick={() => copyAddress()}
              data-testid="wallet-account-copy"
            >
              <span className={actionContent}>
                <span className={actionIcon}>
                  {copied ? <CopiedIcon /> : <CopyIcon />}
                </span>
                <span aria-live="polite">
                  {t(
                    copied ? "wallet_modal.copied" : "wallet_modal.copy_address"
                  )}
                </span>
              </span>
            </button>
            {showDisconnect && (
              <button
                type="button"
                className={action}
                data-testid="wallet-account-disconnect"
                onClick={() => {
                  setOpen(false);
                  logout();
                }}
              >
                <span className={actionContent}>
                  <span className={actionIcon}>
                    <DisconnectIcon />
                  </span>
                  <span>{t("wallet_modal.disconnect")}</span>
                </span>
              </button>
            )}
          </div>
        </div>
      </WalletDialog>
    </>
  );
};
