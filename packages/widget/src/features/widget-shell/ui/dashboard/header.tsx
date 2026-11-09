import { useTranslation } from "react-i18next";
import { IconButton, Stack } from "../../../../ui/index";
import { LeaveConfirmationDialog } from "../../../leave-confirmation/views";
import { AccountModal, ChainModal } from "../../../wallet/views";
import { useHeader } from "../../react/use-header";

/**
 * The Dashboard Layout's wallet controls: the chain and account buttons and
 * the disconnect button, in one row that sits at the end of the tabs' row.
 * While no wallet is connected it renders nothing, so where the controls
 * would wrap under the tabs no empty band is left.
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

  if (hideAccountAndChainSelector) return null;

  if (!walletConfigReady || (!isConnected && !isConnecting)) return null;

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
