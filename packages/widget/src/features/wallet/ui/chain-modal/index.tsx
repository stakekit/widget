import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Title } from "@radix-ui/react-dialog";
import clsx from "clsx";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import { useWidgetConfig } from "../../../../features/widget-configuration/index";
import { shouldShowDisconnect } from "../../../../services/wallet/wallet-connectors";
import { combineRecipeWithVariant } from "../../../../shared/styles/recipe-variant";
import { Box } from "../../../../shared/ui/primitives/box";
import { CaretDownIcon } from "../../../../shared/ui/primitives/icons/caret-down";
import { Text } from "../../../../shared/ui/primitives/typography/text";
import { useTrackEvent } from "../../../tracking/index";
import { useLedgerDisabledChain } from "../../react/use-ledger-disabled-chains";
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
import { WalletDialog, WalletDialogClose } from "../wallet-dialog";
import { WalletChainIcon } from "../wallet-dialog/chain-icon";
import { DisconnectSquareIcon } from "../wallet-dialog/icons";
import { heading, menuButton } from "../wallet-dialog/styles.css";
import {
  chainBody,
  chainIcon,
  chainLabel,
  chainList,
  chainRow,
  connectedDot,
  container,
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
  titleStyle,
  wrongNetwork,
} from "./styles.css";

export const ChainModal = () => {
  const { t } = useTranslation();
  const trackEvent = useTrackEvent();
  const wallet = useSKWallet();
  const variant = useWidgetConfig("variant");
  const disabledChains = useLedgerDisabledChain();
  const selectChain = useAtomSet(selectWalletChainAtom);
  const logout = useAtomSet(logoutAtom);
  const selection = AsyncResult.getOrElse(
    useAtomValue(walletChainSelectionAtom),
    () => undefined
  );
  const chainOpen = AsyncResult.getOrElse(
    useAtomValue(walletChainModalOpenAtom),
    () => false
  );
  const setChainOpen = useAtomSet(setWalletChainModalOpenAtom);

  if (wallet?.status !== "connected") return null;

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
        className={combineRecipeWithVariant({ variant, rec: container })}
        paddingLeft="2"
        py="2"
        onClick={() => {
          trackEvent("chainModalOpened");
          setChainOpen(true);
        }}
      >
        {currentChain && <WalletChainIcon chain={currentChain} size={24} />}
        <Box marginLeft="2">
          <Text className={titleStyle}>{wallet.chain.name}</Text>
        </Box>
        <Box mx="2">
          <CaretDownIcon />
        </Box>
      </Box>

      <WalletDialog
        open={chainOpen}
        onOpenChange={setChainOpen}
        testId="wallet-chain-dialog"
      >
        <div className={chainBody}>
          <div className={header}>
            <span className={headerSpacer} />
            <Title className={clsx(heading, dialogHeading)}>
              {t("wallet_modal.network")}
            </Title>
            <WalletDialogClose onClose={() => setChainOpen(false)} />
          </div>
          {!currentChain && (
            <p className={wrongNetwork}>{t("wallet_modal.wrong_network")}</p>
          )}
          <div className={chainList}>
            {chains.map((chain, index) => {
              const disabled = disabledChainIds.has(chain.id);
              const selected = wallet.chain.id === chain.id;
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
                      if (selected) return;
                      if (disabled) trackEvent("addLedgerAccountClicked");
                      selectChain({ chain, addLedgerAccount: disabled });
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
                  {index < wallet.connectorChains.length - 1 && (
                    <div className={mobileSeparator} />
                  )}
                </Fragment>
              );
            })}
            {!currentChain && shouldShowDisconnect(wallet.connector) && (
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
            )}
          </div>
        </div>
      </WalletDialog>
    </>
  );
};
