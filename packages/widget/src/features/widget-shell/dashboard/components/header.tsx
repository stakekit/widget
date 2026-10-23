import { Box } from "../../../../shared/ui/primitives/box";
import { XIcon } from "../../../../shared/ui/primitives/icons/x-icon";
import { LeaveConfirmationDialog } from "../../../leave-confirmation/views";
import { AccountModal, ChainModal } from "../../../wallet/views";
import { useHeader } from "../../header/use-header";
import { disconnectButton, headerContainer, middleItem } from "./styles.css";

export const Header = () => {
  const {
    onXPress,
    walletConfigReady,
    hideChainSelector,
    isConnected,
    isConnecting,
    showDisconnect,
    headerRef,
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
    <Box ref={headerRef} data-rk="header" className={headerContainer}>
      <Box
        className={middleItem}
        display="flex"
        alignItems="center"
        justifyContent="center"
        gap="2"
      >
        {!hideChainSelector && <ChainModal />}
        <AccountModal />
      </Box>

      {showDisconnect && (
        <Box
          as="button"
          className={disconnectButton}
          onClick={onXPress}
          display="flex"
          alignItems="center"
          justifyContent="flex-end"
        >
          <XIcon hw={24} />
        </Box>
      )}
      <LeaveConfirmationDialog {...leaveConfirmationDialog} />
    </Box>
  );
};
