import { useTranslation } from "react-i18next";
import { IconButton, Stack } from "../../../../ui/index";
import { LeaveConfirmationDialog } from "../../../leave-confirmation/views";
import { AccountModal, ChainModal } from "../../../wallet/views";
import { useHeader } from "../../react/use-header";

/**
 * The Dashboard Layout's wallet controls: the chain and account buttons and
 * the disconnect button, in one row that sits at the end of the tabs' row.
 */
export const Header = () => {
  const { t } = useTranslation();
  const {
    onXPress,
    walletConfigReady,
    hideChainSelector,
    isConnected,
    isConnecting,
    showDisconnect,
    hideAccountAndChainSelector,
    leaveConfirmationDialog,
  } = useHeader();

  if (
    !walletConfigReady ||
    hideAccountAndChainSelector ||
    (!isConnected && !isConnecting)
  ) {
    return null;
  }

  return (
    <Stack hostHook="header" direction="row" align="center" gap={8}>
      {!hideChainSelector && <ChainModal triggerSize="tabs" />}
      <AccountModal triggerSize="tabs" />
      {showDisconnect && (
        <IconButton
          icon="XIcon"
          label={t("wallet_modal.disconnect")}
          onClick={onXPress}
        />
      )}
      <LeaveConfirmationDialog {...leaveConfirmationDialog} />
    </Stack>
  );
};
