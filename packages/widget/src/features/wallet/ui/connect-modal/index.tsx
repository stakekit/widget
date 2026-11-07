import { useAtomSet, useAtomValue } from "@effect/atom-react";
import type { PropsWithChildren } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { ConnectorWithWalletDetails } from "../../../../services/wallet/wallet-descriptors";
import {
  Avatar,
  Badge,
  Box,
  ChipGroup,
  ListGroup,
  ListRow,
  Modal,
  Notice,
  Spinner,
  Stack,
  VisuallyHidden,
} from "../../../../ui/index";
import {
  type ConnectPickerRow,
  type ConnectPickerSection,
  type ConnectPickerWallet,
  connectPickerSections,
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

/** The ecosystem filter's chip that lists every ecosystem's wallets. */
const allEcosystems = "all";

export const WalletModalsProvider = ({ children }: PropsWithChildren) => (
  <>
    {children}
    <ConnectModal />
  </>
);

/**
 * The wallet picker. It opens onto the wallets, those the user has first;
 * with wallets of several ecosystems, a row of chips narrows the list to
 * one ecosystem.
 */
const ConnectModal = () => {
  const { t } = useTranslation();
  const isOpen = useAtomValue(walletConnectModalOpenAtom);
  const presentationOpen = useAtomValue(walletConnectPresentationOpenAtom);
  const setOpen = useAtomSet(setWalletConnectModalOpenAtom);
  const [ecosystemId, setEcosystemId] = useState<string | undefined>();
  const connect = useAtomSet(connectWalletAtom);
  const attempt = useAtomValue(walletConnectionAttemptAtom);

  const ecosystems = useAtomValue(connectPickerAtom);
  const sections = connectPickerSections(ecosystems, ecosystemId);
  const filter =
    ecosystems.find(({ chainGroup }) => chainGroup.id === ecosystemId)
      ?.chainGroup.id ?? allEcosystems;

  const setModalOpen = (nextIsOpen: boolean) => {
    setOpen(nextIsOpen);
    if (!nextIsOpen) setEcosystemId(undefined);
  };

  return (
    <Modal
      open={isOpen}
      suspended={presentationOpen}
      onOpenChange={setModalOpen}
      testId="wallet-connect-dialog"
      bodyTestId="wallet-connect-list"
      title={t("wallet_modal.connect_wallet")}
      titleStatus={attempt._tag === "Pending" && <Spinner size="sm" />}
      closeLabel={t("wallet_modal.close")}
    >
      <Stack gap={16}>
        {ecosystems.length > 1 && (
          <ChipGroup
            label={t("wallet_modal.ecosystems")}
            options={[
              { value: allEcosystems, label: t("wallet_modal.all_ecosystems") },
              ...ecosystems.map(({ chainGroup }) => ({
                value: chainGroup.id,
                label: chainGroup.title,
              })),
            ]}
            value={[filter]}
            onValueChange={(next) => {
              const chosen = next.find((value) => value !== filter) ?? filter;
              setEcosystemId(chosen === allEcosystems ? undefined : chosen);
            }}
          />
        )}
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
        <WalletSections sections={sections} onConnect={connect} />
      </Stack>
    </Modal>
  );
};

const WalletSections = ({
  sections,
  onConnect,
}: {
  readonly sections: ReadonlyArray<ConnectPickerSection>;
  readonly onConnect: (connector: ConnectorWithWalletDetails) => void;
}) => {
  const { t } = useTranslation();
  const sectionTitle = ({ label }: ConnectPickerSection) => {
    if (label._tag === "Installed") return t("wallet_modal.groups.installed");
    if (label._tag === "Ecosystem") return label.title;
    const key = groupNameKeys[label.name];
    return key ? t(key) : label.name;
  };
  const options = (rows: ReadonlyArray<ConnectPickerRow>) =>
    rows.map((row) => (
      <WalletOption key={row.wallet.id} row={row} onConnect={onConnect} />
    ));

  if (sections.length === 1) {
    return (
      <ListGroup density="condensed">
        {options(sections[0]?.rows ?? [])}
      </ListGroup>
    );
  }

  return (
    <Stack gap={16}>
      {sections.map((section) => (
        <ListGroup
          key={section.id}
          label={sectionTitle(section)}
          density="condensed"
        >
          {options(section.rows)}
        </ListGroup>
      ))}
    </Stack>
  );
};

const WalletOption = ({
  row: { ecosystem, wallet },
  onConnect,
}: {
  readonly row: ConnectPickerRow;
  readonly onConnect: (connector: ConnectorWithWalletDetails) => void;
}) => {
  const { t } = useTranslation();
  const common = {
    testId: `connect-wallet-${wallet.id}`,
    leading: <OptionIcon iconUrl={wallet.iconUrl} title={wallet.title} />,
    title: wallet.title,
    ...(ecosystem === undefined ? {} : { subtitle: ecosystem }),
  };

  if (wallet.action._tag === "Install") {
    return (
      <ListRow
        {...common}
        trailing={<Badge tone="accent">{t("wallet_modal.install")}</Badge>}
        link={{ href: wallet.action.url, newTab: true }}
      />
    );
  }

  if (wallet.action._tag === "Checking") {
    return (
      <ListRow
        {...common}
        badges={<VisuallyHidden>{t("wallet_modal.checking")}</VisuallyHidden>}
        busy
      />
    );
  }

  const { connector } = wallet;
  return <ListRow {...common} onClick={() => onConnect(connector)} />;
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
    fallback={title}
    shape="square"
    size="control"
  />
);
