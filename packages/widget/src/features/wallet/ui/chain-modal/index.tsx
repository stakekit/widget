import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Title } from "@radix-ui/react-dialog";
import clsx from "clsx";
import { Fragment, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useWidgetConfig } from "../../../../features/widget-configuration/index";
import { shouldShowDisconnect } from "../../../../services/wallet/wallet-connectors";
import type { Chain } from "../../../../services/wallet/wallet-descriptors";
import { combineRecipeWithVariant } from "../../../../shared/styles/recipe-variant";
import { Box } from "../../../../shared/ui/primitives/box";
import { CaretDownIcon } from "../../../../shared/ui/primitives/icons/caret-down";
import { Text } from "../../../../shared/ui/primitives/typography/text";
import { useTrackEvent } from "../../../tracking/index";
import { useLedgerDisabledChain } from "../../react/use-ledger-disabled-chains";
import { useSKWallet } from "../../react/use-wallet";
import {
  useScopedWalletChainSelection,
  WalletChainSelectionScope,
} from "../../react/wallet-chain-selection-scope";
import {
  selectWalletChainAtom,
  walletChainSelectionAtom,
} from "../../state/account-presentation";
import {
  setWalletChainModalOpenAtom,
  walletChainModalOpenAtom,
} from "../../state/wallet-modal";
import { logoutAtom } from "../../state/workflows";
import { WalletDialog, WalletDialogClose } from "../wallet-dialog";
import { WalletChainIcon } from "../wallet-dialog/chain-icon";
import { DisconnectSquareIcon } from "../wallet-dialog/icons";
import {
  heading,
  menuButton,
  walletSummaryTitle,
  walletSummaryTrigger,
} from "../wallet-dialog/styles.css";
import {
  chainBody,
  chainIcon,
  chainLabel,
  chainList,
  chainRow,
  connectedDot,
  dialogHeading,
  disabledRow,
  disconnectRow,
  errorDot,
  header,
  headerSpacer,
  mobileSeparator,
  pendingDot,
  separator,
  status,
  wrongNetwork,
} from "./styles.css";

type ChainDialogProps = {
  readonly chains: ReadonlyArray<Chain>;
  readonly currentChainId: number | null;
  readonly disabledChainIds: ReadonlySet<number>;
  readonly footer: ReactNode;
  readonly notice: ReactNode;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSelect: (chain: Chain) => void;
  readonly open: boolean;
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
}: ChainDialogProps) => {
  const { t } = useTranslation();
  const selection = useAtomValue(walletChainSelectionAtom);

  return (
    <WalletDialog
      open={open}
      onOpenChange={onOpenChange}
      testId="wallet-chain-dialog"
    >
      <div className={chainBody}>
        <div className={header}>
          <span className={headerSpacer} />
          <Title className={clsx(heading, dialogHeading)}>
            {t("wallet_modal.network")}
          </Title>
          <WalletDialogClose onClose={() => onOpenChange(false)} />
        </div>
        {notice}
        <div className={chainList}>
          {chains.map((chain, index) => {
            const disabled = disabledChainIds.has(chain.id);
            const selected = currentChainId === chain.id;
            const pending = selection?.pendingChainId === chain.id;
            const failed = selection?.failedChainId === chain.id;

            return (
              <Fragment key={chain.id}>
                <button
                  type="button"
                  className={menuButton}
                  data-testid={`wallet-chain-${chain.id}`}
                  aria-current={selected || undefined}
                  onClick={() => {
                    if (!selected) onSelect(chain);
                  }}
                >
                  <span className={clsx(chainRow, disabled && disabledRow)}>
                    <span className={chainLabel}>
                      <WalletChainIcon chain={chain} className={chainIcon} />
                      <span>{chain.name}</span>
                    </span>
                    {selected && (
                      <span className={status}>
                        {t("wallet_modal.connected")}
                        <span className={connectedDot} />
                      </span>
                    )}
                    {!selected && (pending || failed) && (
                      <span className={status} role="status">
                        {t(
                          failed
                            ? "wallet_modal.confirm_error"
                            : "wallet_modal.confirm"
                        )}
                        <span className={failed ? errorDot : pendingDot} />
                      </span>
                    )}
                    {!selected && !pending && !failed && disabled && (
                      <span className={status}>
                        {t("chain_modal.disabled_chain_info")}
                      </span>
                    )}
                  </span>
                </button>
                {index < chains.length - 1 && (
                  <div className={mobileSeparator} />
                )}
              </Fragment>
            );
          })}
          {footer}
        </div>
      </div>
    </WalletDialog>
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
    <WalletChainSelectionScope>
      <ScopedWalletChainPicker chains={chains} onOpenChange={onOpenChange} />
    </WalletChainSelectionScope>
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

export const ChainModal = () => {
  const { t } = useTranslation();
  const trackEvent = useTrackEvent();
  const wallet = useSKWallet();
  const variant = useWidgetConfig("variant");
  const disabledChains = useLedgerDisabledChain();
  const logout = useAtomSet(logoutAtom);
  const chainOpen = useAtomValue(walletChainModalOpenAtom);
  const setChainOpen = useAtomSet(setWalletChainModalOpenAtom);
  const selectChain = useAtomSet(selectWalletChainAtom);

  // A connecting wallet keeps its scope owner while a network switch settles.
  if (!wallet?.network) return null;

  const disabledChainIds = new Set(disabledChains.map((chain) => chain.id));
  const chains = [
    ...wallet.connectorChains.filter(
      (chain) => !disabledChainIds.has(chain.id)
    ),
    ...disabledChains,
  ];
  const currentChain = wallet.connectorChains.find(
    (chain) => chain.id === wallet.chain.id
  );

  return (
    <>
      <Box
        data-rk="chain-modal-container"
        as="button"
        type="button"
        borderRadius="2xl"
        background="backgroundMuted"
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        className={combineRecipeWithVariant({
          variant,
          rec: walletSummaryTrigger,
        })}
        paddingLeft="2"
        py="2"
        onClick={() => {
          trackEvent("chainModalOpened");
          setChainOpen(true);
        }}
      >
        {currentChain && <WalletChainIcon chain={currentChain} size={24} />}
        <Box marginLeft="2">
          <Text className={walletSummaryTitle}>{wallet.chain.name}</Text>
        </Box>
        <Box mx="2">
          <CaretDownIcon />
        </Box>
      </Box>

      <ChainDialog
        chains={chains}
        currentChainId={wallet.chain.id}
        disabledChainIds={disabledChainIds}
        footer={
          !currentChain &&
          shouldShowDisconnect(wallet.connector) && (
            <>
              <div className={separator} />
              <button
                type="button"
                className={clsx(menuButton, disconnectRow)}
                onClick={() => {
                  setChainOpen(false);
                  logout();
                }}
              >
                <span className={chainLabel}>
                  <DisconnectSquareIcon />
                  {t("wallet_modal.disconnect")}
                </span>
              </button>
            </>
          )
        }
        notice={
          !currentChain && (
            <p className={wrongNetwork}>{t("wallet_modal.wrong_network")}</p>
          )
        }
        onOpenChange={setChainOpen}
        onSelect={(chain) => {
          const addLedgerAccount = disabledChainIds.has(chain.id);
          if (addLedgerAccount) trackEvent("addLedgerAccountClicked");
          selectChain({ addLedgerAccount, chain });
        }}
        open={chainOpen}
      />
    </>
  );
};
