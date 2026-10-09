import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Title } from "@radix-ui/react-dialog";
import { Root as VisuallyHiddenRoot } from "@radix-ui/react-visually-hidden";
import clsx from "clsx";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import type { PropsWithChildren } from "react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ConnectorWithWalletDetails } from "../../../../services/wallet/wallet-descriptors";
import { Image } from "../../../../shared/ui/primitives/image";
import { Spinner } from "../../../../shared/ui/primitives/spinner";
import type {
  ConnectPickerGroup,
  ConnectPickerWallet,
} from "../../model/connect-picker";
import {
  connectPickerAtom,
  connectWalletAtom,
  setWalletConnectModalOpenAtom,
  walletConnectionAttemptAtom,
  walletConnectModalOpenAtom,
  walletConnectPresentationOpenAtom,
} from "../../state/wallet-modal";
import { WalletDialog, WalletDialogClose } from "../wallet-dialog";
import { useWalletIconUrl } from "../wallet-dialog/icon-url";
import { BackIcon } from "../wallet-dialog/icons";
import { closeButton, heading, menuButton } from "../wallet-dialog/styles.css";
import {
  body,
  checkingHint,
  checkingOption,
  disclaimer,
  error,
  group,
  groupHeading,
  header,
  headerSlot,
  installHint,
  list,
  option,
  optionRow,
  optionTitle,
  title,
} from "./styles.css";

// Catalogue group names owned by the widget; host policy group names render as given.
const groupNameKeys: Readonly<
  Partial<Record<string, `wallet_modal.groups.${"other" | "primary"}`>>
> = {
  Other: "wallet_modal.groups.other",
  Primary: "wallet_modal.groups.primary",
};

export const WalletModalsProvider = ({ children }: PropsWithChildren) => (
  <>
    {children}
    <ConnectModal />
  </>
);

const ConnectModal = () => {
  const { t } = useTranslation();
  const isOpen = AsyncResult.getOrElse(
    useAtomValue(walletConnectModalOpenAtom),
    () => false
  );
  const presentationOpen = AsyncResult.getOrElse(
    useAtomValue(walletConnectPresentationOpenAtom),
    () => false
  );
  const setOpen = useAtomSet(setWalletConnectModalOpenAtom);
  const [selectedChainGroupId, setSelectedChainGroupId] = useState<
    string | undefined
  >();
  const connect = useAtomSet(connectWalletAtom);
  const attempt = AsyncResult.getOrElse(
    useAtomValue(walletConnectionAttemptAtom),
    () => ({ _tag: "Idle" as const })
  );

  const ecosystems = AsyncResult.getOrElse(
    useAtomValue(connectPickerAtom),
    () => []
  );
  const activeEcosystem = ecosystems.find(
    ({ chainGroup }) =>
      chainGroup.id === selectedChainGroupId || ecosystems.length === 1
  );
  const canChooseAnotherEcosystem = !!activeEcosystem && ecosystems.length > 1;

  const setModalOpen = (nextIsOpen: boolean) => {
    setOpen(nextIsOpen);

    if (!nextIsOpen) {
      setSelectedChainGroupId(undefined);
    }
  };

  return (
    <WalletDialog
      open={isOpen}
      suspended={presentationOpen}
      onOpenChange={setModalOpen}
      testId="wallet-connect-dialog"
    >
      <div className={body}>
        <div className={header}>
          <span className={headerSlot}>
            {canChooseAnotherEcosystem && (
              <button
                type="button"
                className={closeButton}
                aria-label={t("wallet_modal.change_ecosystem")}
                data-testid="connect-ecosystem-back"
                onClick={() => {
                  setOpen(true);
                  setSelectedChainGroupId(undefined);
                }}
              >
                <BackIcon />
              </button>
            )}
          </span>
          <div className={title}>
            <Title className={heading}>
              {t(
                activeEcosystem
                  ? "wallet_modal.connect_wallet"
                  : "wallet_modal.select_ecosystem"
              )}
            </Title>
            {attempt._tag === "Pending" && <Spinner />}
          </div>
          <WalletDialogClose onClose={() => setModalOpen(false)} />
        </div>
        {attempt._tag === "Failed" && (
          <p className={error} role="alert">
            {t("wallet_modal.connection_error")}
          </p>
        )}
        {attempt._tag === "WalletNotAvailable" && (
          <p className={error} role="alert">
            {t("wallet_modal.wallet_not_available")}
          </p>
        )}
        <div className={list} data-testid="wallet-connect-list">
          {activeEcosystem ? (
            <WalletGroups groups={activeEcosystem.groups} onConnect={connect} />
          ) : (
            ecosystems.map(({ chainGroup }) => (
              <button
                key={chainGroup.id}
                type="button"
                className={menuButton}
                data-testid={`connect-ecosystem-${chainGroup.id}`}
                onClick={() => {
                  setSelectedChainGroupId(chainGroup.id);
                  setOpen(true);
                }}
              >
                <OptionContent
                  iconUrl={chainGroup.iconUrl}
                  title={chainGroup.title}
                />
              </button>
            ))
          )}
        </div>
      </div>
      <p className={disclaimer}>{t("chain_modal_disclaimer")}</p>
    </WalletDialog>
  );
};

const WalletGroups = ({
  groups,
  onConnect,
}: {
  readonly groups: ReadonlyArray<ConnectPickerGroup>;
  readonly onConnect: (connector: ConnectorWithWalletDetails) => void;
}) => {
  if (groups.length === 1) {
    return groups[0]?.wallets.map((wallet) => (
      <WalletOption key={wallet.id} wallet={wallet} onConnect={onConnect} />
    ));
  }

  return groups.map((walletGroup) => (
    <WalletGroup
      key={walletGroup.id}
      walletGroup={walletGroup}
      onConnect={onConnect}
    />
  ));
};

const WalletGroup = ({
  walletGroup,
  onConnect,
}: {
  readonly walletGroup: ConnectPickerGroup;
  readonly onConnect: (connector: ConnectorWithWalletDetails) => void;
}) => {
  const { t } = useTranslation();
  const headingId = useId();
  const groupTitle = () => {
    const { label } = walletGroup;
    if (label._tag === "Installed") return t("wallet_modal.groups.installed");
    const key = groupNameKeys[label.name];
    return key ? t(key) : label.name;
  };

  return (
    <section className={group} aria-labelledby={headingId}>
      <h3 id={headingId} className={groupHeading}>
        {groupTitle()}
      </h3>
      {walletGroup.wallets.map((wallet) => (
        <WalletOption key={wallet.id} wallet={wallet} onConnect={onConnect} />
      ))}
    </section>
  );
};

const WalletOption = ({
  wallet,
  onConnect,
}: {
  readonly wallet: ConnectPickerWallet;
  readonly onConnect: (connector: ConnectorWithWalletDetails) => void;
}) => {
  const { t } = useTranslation();

  if (wallet.action._tag === "Install") {
    return (
      <a
        className={clsx(menuButton, option)}
        data-testid={`connect-wallet-${wallet.id}`}
        href={wallet.action.url}
        target="_blank"
        rel="noopener noreferrer"
      >
        <OptionContent iconUrl={wallet.iconUrl} title={wallet.title}>
          <span className={installHint}>{t("wallet_modal.install")}</span>
        </OptionContent>
      </a>
    );
  }

  if (wallet.action._tag === "Checking") {
    return (
      <div
        className={clsx(menuButton, checkingOption)}
        data-testid={`connect-wallet-${wallet.id}`}
        aria-busy="true"
        aria-disabled="true"
      >
        <OptionContent iconUrl={wallet.iconUrl} title={wallet.title}>
          <span className={checkingHint} aria-hidden="true" />
          <VisuallyHiddenRoot>{t("wallet_modal.checking")}</VisuallyHiddenRoot>
        </OptionContent>
      </div>
    );
  }

  return (
    <button
      type="button"
      className={menuButton}
      data-testid={`connect-wallet-${wallet.id}`}
      onClick={() => onConnect(wallet.connector)}
    >
      <OptionContent iconUrl={wallet.iconUrl} title={wallet.title} />
    </button>
  );
};

const OptionContent = ({
  children,
  iconUrl,
  title: optionName,
}: PropsWithChildren<{
  readonly iconUrl: ConnectPickerWallet["iconUrl"];
  readonly title: string;
}>) => {
  const resolvedIconUrl = useWalletIconUrl(iconUrl);

  return (
    <span className={optionRow}>
      <Image
        src={resolvedIconUrl}
        fallbackName={optionName}
        wrapperProps={{ borderRadius: "lg", hw: "7" }}
        imgProps={{ borderRadius: "lg", hw: "7" }}
      />
      <span className={optionTitle}>{optionName}</span>
      {children}
    </span>
  );
};
