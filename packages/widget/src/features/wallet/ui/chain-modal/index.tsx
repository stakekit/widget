import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";

import { shouldShowDisconnect } from "../../../../services/wallet/wallet-connectors";
import type { Chain } from "../../../../services/wallet/wallet-descriptors";
import {
  Notice,
  SelectSheet,
  type SelectSheetAction,
  TokenTrigger,
} from "../../../../ui/index";
import { useLeaveConfirmation } from "../../../leave-confirmation/index";
import { LeaveConfirmationDialog } from "../../../leave-confirmation/views";
import { useTrackEvent } from "../../../tracking/index";
import { networkPickerGroups } from "../../model/network-picker";
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
  /** A button under the networks, such as disconnecting the wallet. */
  readonly footer?: SelectSheetAction;
  readonly notice: ReactNode;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSelect: (chain: Chain) => void;
  readonly open: boolean;
  /** Hidden, without closing, while another surface asks over it. */
  readonly suspended?: boolean;
};

/**
 * The network picker: the connected network, then the networks and the
 * testnets, filtered by name. It stays open while a chosen network is
 * confirmed in the wallet; choosing the connected one closes it.
 */
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
  // The sheet clears it as it closes.
  const [query, setQuery] = useState("");
  const groupLabels = {
    Current: t("chain_modal.groups.current"),
    Networks: t("chain_modal.groups.networks"),
    Testnets: t("chain_modal.groups.testnets"),
  } as const;
  const chainsById = new Map(chains.map((chain) => [String(chain.id), chain]));

  const option = (chain: Chain) => {
    const selected = currentChainId === chain.id;
    const failed = !selected && selection?.failedChainId === chain.id;
    const pending = !selected && selection?.pendingChainId === chain.id;
    const badge = (() => {
      if (failed) {
        return {
          label: t("wallet_modal.confirm_error"),
          tone: "danger",
          announce: true,
        } as const;
      }
      if (pending) {
        return {
          label: t("wallet_modal.confirm"),
          tone: "warning",
          announce: true,
        } as const;
      }
      return undefined;
    })();

    return {
      id: String(chain.id),
      title: chain.name,
      testId: `wallet-chain-${chain.id}`,
      leading: <WalletChainIcon chain={chain} size="sm" />,
      ...(badge === undefined ? {} : { badges: [badge] }),
      ...(disabledChainIds.has(chain.id) && !selected && badge === undefined
        ? { subtitle: t("chain_modal.disabled_chain_info") }
        : {}),
    };
  };

  return (
    <SelectSheet
      open={open}
      onOpenChange={onOpenChange}
      suspended={suspended}
      density="condensed"
      closesOnSelect={false}
      testIds={{ container: "wallet-chain-dialog" }}
      title={t("wallet_modal.network")}
      closeLabel={t("wallet_modal.close")}
      listLabel={t("wallet_modal.network")}
      notice={notice}
      search={{
        value: query,
        onValueChange: setQuery,
        label: t("chain_modal.search"),
        placeholder: t("chain_modal.search"),
        clearLabel: t("shared.clear_search"),
      }}
      empty={{ title: t("chain_modal.no_results") }}
      groups={networkPickerGroups({ chains, currentChainId, query }).map(
        (group) => ({
          key: group.kind,
          label: groupLabels[group.kind],
          options: group.chains.map(option),
        })
      )}
      {...(currentChainId === null
        ? {}
        : { selectedId: String(currentChainId) })}
      onSelect={(id) => {
        const chain = chainsById.get(id);
        if (chain === undefined) return;
        if (chain.id === currentChainId) onOpenChange(false);
        else onSelect(chain);
      }}
      {...(footer === undefined ? {} : { footer })}
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
        {...(!currentChain && shouldShowDisconnect(wallet.connector)
          ? {
              footer: {
                label: t("wallet_modal.disconnect"),
                onClick: () =>
                  leaveConfirmation.confirm(() => {
                    setChainOpen(false);
                    logout();
                  }),
              },
            }
          : {})}
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
