import { useAtomSet, useAtomValue } from "@effect/atom-react";
import type { PropsWithChildren } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { ConnectorWithWalletDetails } from "../../../../services/wallet/wallet-descriptors";
import {
  Avatar,
  Badge,
  Box,
  ListGroup,
  ListRow,
  Modal,
  Notice,
  Spinner,
  Text,
  VisuallyHidden,
} from "../../../../ui/index";
import type {
  ConnectPickerGroup,
  ConnectPickerWallet,
} from "../../model/connect-picker";
import { walletIconUrlAtom } from "../../state/wallet-icon";
import {
  connectPickerAtom,
  connectWalletAtom,
  setWalletConnectModalOpenAtom,
  walletConnectionAttemptAtom,
  walletConnectModalOpenAtom,
  walletConnectPresentationOpenAtom,
} from "../../state/wallet-modal";

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
  const isOpen = useAtomValue(walletConnectModalOpenAtom);
  const presentationOpen = useAtomValue(walletConnectPresentationOpenAtom);
  const setOpen = useAtomSet(setWalletConnectModalOpenAtom);
  const [selectedChainGroupId, setSelectedChainGroupId] = useState<
    string | undefined
  >();
  const connect = useAtomSet(connectWalletAtom);
  const attempt = useAtomValue(walletConnectionAttemptAtom);

  const ecosystems = useAtomValue(connectPickerAtom);
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
    <Modal
      open={isOpen}
      suspended={presentationOpen}
      onOpenChange={setModalOpen}
      testId="wallet-connect-dialog"
      bodyTestId="wallet-connect-list"
      title={t(
        activeEcosystem
          ? "wallet_modal.connect_wallet"
          : "wallet_modal.select_ecosystem"
      )}
      titleStatus={attempt._tag === "Pending" && <Spinner size="sm" />}
      closeLabel={t("wallet_modal.close")}
      {...(canChooseAnotherEcosystem
        ? {
            back: {
              label: t("wallet_modal.change_ecosystem"),
              testId: "connect-ecosystem-back",
              onBack: () => {
                setOpen(true);
                setSelectedChainGroupId(undefined);
              },
            },
          }
        : {})}
      footer={
        <Text variant="caption" tone="muted" align="center">
          {t("chain_modal_disclaimer")}
        </Text>
      }
    >
      {attempt._tag === "Failed" && (
        <Box role="alert">
          <Notice tone="danger">{t("wallet_modal.connection_error")}</Notice>
        </Box>
      )}
      {attempt._tag === "WalletNotAvailable" && (
        <Box role="alert">
          <Notice tone="danger">
            {t("wallet_modal.wallet_not_available")}
          </Notice>
        </Box>
      )}
      {activeEcosystem ? (
        <WalletGroups groups={activeEcosystem.groups} onConnect={connect} />
      ) : (
        <ListGroup>
          {ecosystems.map(({ chainGroup }) => (
            <ListRow
              key={chainGroup.id}
              testId={`connect-ecosystem-${chainGroup.id}`}
              leading={
                <OptionIcon
                  iconUrl={chainGroup.iconUrl}
                  title={chainGroup.title}
                />
              }
              title={chainGroup.title}
              onClick={() => {
                setSelectedChainGroupId(chainGroup.id);
                setOpen(true);
              }}
            />
          ))}
        </ListGroup>
      )}
    </Modal>
  );
};

const WalletGroups = ({
  groups,
  onConnect,
}: {
  readonly groups: ReadonlyArray<ConnectPickerGroup>;
  readonly onConnect: (connector: ConnectorWithWalletDetails) => void;
}) => {
  const { t } = useTranslation();
  const groupTitle = ({ label }: ConnectPickerGroup) => {
    if (label._tag === "Installed") return t("wallet_modal.groups.installed");
    const key = groupNameKeys[label.name];
    return key ? t(key) : label.name;
  };

  if (groups.length === 1) {
    return (
      <ListGroup>
        {groups[0]?.wallets.map((wallet) => (
          <WalletOption key={wallet.id} wallet={wallet} onConnect={onConnect} />
        ))}
      </ListGroup>
    );
  }

  return groups.map((walletGroup) => (
    <ListGroup key={walletGroup.id} label={groupTitle(walletGroup)}>
      {walletGroup.wallets.map((wallet) => (
        <WalletOption key={wallet.id} wallet={wallet} onConnect={onConnect} />
      ))}
    </ListGroup>
  ));
};

const WalletOption = ({
  wallet,
  onConnect,
}: {
  readonly wallet: ConnectPickerWallet;
  readonly onConnect: (connector: ConnectorWithWalletDetails) => void;
}) => {
  const { t } = useTranslation();
  const testId = `connect-wallet-${wallet.id}`;
  const leading = <OptionIcon iconUrl={wallet.iconUrl} title={wallet.title} />;

  if (wallet.action._tag === "Install") {
    return (
      <ListRow
        testId={testId}
        leading={leading}
        title={wallet.title}
        badges={<Badge tone="accent">{t("wallet_modal.install")}</Badge>}
        link={{ href: wallet.action.url, newTab: true }}
      />
    );
  }

  if (wallet.action._tag === "Checking") {
    return (
      <ListRow
        testId={testId}
        leading={leading}
        title={wallet.title}
        badges={<VisuallyHidden>{t("wallet_modal.checking")}</VisuallyHidden>}
        busy
      />
    );
  }

  const { connector } = wallet;
  return (
    <ListRow
      testId={testId}
      leading={leading}
      title={wallet.title}
      onClick={() => onConnect(connector)}
    />
  );
};

const OptionIcon = ({
  iconUrl,
  title,
}: {
  readonly iconUrl: ConnectPickerWallet["iconUrl"];
  readonly title: string;
}) => (
  <Avatar
    src={useAtomValue(walletIconUrlAtom(iconUrl))}
    fallback={Array.from(title.trim())[0]?.toUpperCase() ?? ""}
    shape="square"
  />
);
