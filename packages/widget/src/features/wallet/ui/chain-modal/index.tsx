import { useAtomSet, useAtomValue } from "@effect/atom-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { shouldShowDisconnect } from "../../../../services/wallet/wallet-connectors";
import type { Chain } from "../../../../services/wallet/wallet-descriptors";
import {
  Badge,
  Divider,
  Icon,
  ListGroup,
  ListRow,
  Modal,
  Notice,
  TokenTrigger,
} from "../../../../ui/index";
import { useLeaveConfirmation } from "../../../leave-confirmation/index";
import { LeaveConfirmationDialog } from "../../../leave-confirmation/views";
import { useTrackEvent } from "../../../tracking/index";
import { useLedgerDisabledChain } from "../../react/use-ledger-disabled-chains";
import { useScopedWalletChainSelection } from "../../react/use-scoped-wallet-chain-selection";
import { useSKWallet } from "../../react/use-wallet";
import {
  selectWalletChainAtom,
  walletChainSelectionAtom,
} from "../../state/account-presentation";
import {
  setWalletChainModalOpenAtom,
  walletChainModalOpenAtom,
} from "../../state/wallet-modal";
import { logoutAtom } from "../../state/workflows";
import {
  useWalletChainIconUrl,
  WalletChainIcon,
} from "../wallet-dialog/chain-icon";

type ChainDialogProps = {
  readonly chains: ReadonlyArray<Chain>;
  readonly currentChainId: number | null;
  readonly disabledChainIds: ReadonlySet<number>;
  readonly footer: ReactNode;
  readonly notice: ReactNode;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSelect: (chain: Chain) => void;
  readonly open: boolean;
  /** Hidden, without closing, while another surface asks over it. */
  readonly suspended?: boolean;
};

const ChainDialog = ({
  chains,
  currentChainId,
  disabledChainIds,
  footer,
  notice,
  onOpenChange,
  onSelect,
  open,
  suspended = false,
}: ChainDialogProps) => {
  const { t } = useTranslation();
  const selection = useAtomValue(walletChainSelectionAtom);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      suspended={suspended}
      testId="wallet-chain-dialog"
      title={t("wallet_modal.network")}
      closeLabel={t("wallet_modal.close")}
    >
      {notice}
      <ListGroup density="condensed">
        {chains.map((chain) => {
          const selected = currentChainId === chain.id;

          return (
            <ChainRow
              key={chain.id}
              chain={chain}
              selected={selected}
              pending={!selected && selection?.pendingChainId === chain.id}
              failed={!selected && selection?.failedChainId === chain.id}
              disabled={disabledChainIds.has(chain.id)}
              onSelect={() => {
                if (!selected) onSelect(chain);
              }}
            />
          );
        })}
      </ListGroup>
      {footer}
    </Modal>
  );
};

const ChainRow = ({
  chain,
  selected,
  pending,
  failed,
  disabled,
  onSelect,
}: {
  readonly chain: Chain;
  readonly selected: boolean;
  readonly pending: boolean;
  readonly failed: boolean;
  readonly disabled: boolean;
  readonly onSelect: () => void;
}) => {
  const { t } = useTranslation();
  const status = (() => {
    // The connected network shows the row's trailing check.
    if (selected) return undefined;
    if (failed) {
      return (
        <Badge tone="danger" role="status">
          {t("wallet_modal.confirm_error")}
        </Badge>
      );
    }
    if (pending) {
      return (
        <Badge tone="warning" role="status">
          {t("wallet_modal.confirm")}
        </Badge>
      );
    }
    return undefined;
  })();

  return (
    <ListRow
      testId={`wallet-chain-${chain.id}`}
      leading={<WalletChainIcon chain={chain} />}
      title={chain.name}
      {...(status === undefined ? {} : { badges: status })}
      {...(disabled && !selected && !pending && !failed
        ? { subtitle: t("chain_modal.disabled_chain_info") }
        : {})}
      selected={selected}
      onClick={onSelect}
    />
  );
};

/**
 * The network dialog limited to `chains`, for a feature that needs the wallet
 * on one of them. It owns the selections made in it: closing or unmounting it
 * interrupts a pending one.
 */
export const WalletChainPicker = ({
  chains,
  onOpenChange,
  open,
}: {
  readonly chains: ReadonlyArray<Chain>;
  readonly onOpenChange: (open: boolean) => void;
  readonly open: boolean;
}) =>
  open ? (
    <ScopedWalletChainPicker chains={chains} onOpenChange={onOpenChange} />
  ) : null;

const ScopedWalletChainPicker = ({
  chains,
  onOpenChange,
}: {
  readonly chains: ReadonlyArray<Chain>;
  readonly onOpenChange: (open: boolean) => void;
}) => {
  const wallet = useSKWallet();
  const { disabledChainIds, selectChain } = useScopedWalletChainSelection();

  return (
    <ChainDialog
      chains={chains}
      currentChainId={wallet?.chain?.id ?? null}
      disabledChainIds={disabledChainIds}
      footer={null}
      notice={null}
      onOpenChange={onOpenChange}
      onSelect={selectChain}
      open
    />
  );
};

/**
 * The wallet header's network pill and the network dialog it opens.
 * `triggerSize` sizes the pill to its header's row.
 */
export const ChainModal = ({
  triggerSize,
}: {
  readonly triggerSize: "sm" | "tabs";
}) => {
  const { t } = useTranslation();
  const trackEvent = useTrackEvent();
  const wallet = useSKWallet();
  const disabledChains = useLedgerDisabledChain();
  const logout = useAtomSet(logoutAtom);
  const chainOpen = useAtomValue(walletChainModalOpenAtom);
  const setChainOpen = useAtomSet(setWalletChainModalOpenAtom);
  const selectChain = useAtomSet(selectWalletChainAtom);
  const currentChain = wallet?.network
    ? wallet.connectorChains.find((chain) => chain.id === wallet.chain.id)
    : undefined;
  const leaveConfirmation = useLeaveConfirmation();
  const currentChainIconUrl = useWalletChainIconUrl(currentChain);

  // A connecting wallet keeps its scope owner while a network switch settles.
  if (!wallet?.network) return null;

  const disabledChainIds = new Set(disabledChains.map((chain) => chain.id));
  const chains = [
    ...wallet.connectorChains.filter(
      (chain) => !disabledChainIds.has(chain.id)
    ),
    ...disabledChains,
  ];

  return (
    <>
      <TokenTrigger
        hostHook="chain-modal-container"
        size={triggerSize}
        token={{
          name: wallet.chain.name,
          ...(currentChainIconUrl === undefined
            ? {}
            : { src: currentChainIconUrl }),
        }}
        onClick={() => {
          trackEvent("chainModalOpened");
          setChainOpen(true);
        }}
      />

      <ChainDialog
        chains={chains}
        currentChainId={wallet.chain.id}
        disabledChainIds={disabledChainIds}
        footer={
          !currentChain &&
          shouldShowDisconnect(wallet.connector) && (
            <>
              <Divider />
              <ListRow
                density="condensed"
                leading={<Icon name="DisconnectSquareIcon" size="lg" />}
                title={t("wallet_modal.disconnect")}
                onClick={() =>
                  leaveConfirmation.confirm(() => {
                    setChainOpen(false);
                    logout();
                  })
                }
              />
            </>
          )
        }
        notice={
          !currentChain && (
            <Notice tone="warning">{t("wallet_modal.wrong_network")}</Notice>
          )
        }
        onOpenChange={setChainOpen}
        onSelect={(chain) =>
          leaveConfirmation.confirm(() => {
            const addLedgerAccount = disabledChainIds.has(chain.id);
            if (addLedgerAccount) trackEvent("addLedgerAccountClicked");
            selectChain({ addLedgerAccount, chain });
          })
        }
        open={chainOpen}
        suspended={leaveConfirmation.pending}
      />
      <LeaveConfirmationDialog {...leaveConfirmation.dialog} />
    </>
  );
};
