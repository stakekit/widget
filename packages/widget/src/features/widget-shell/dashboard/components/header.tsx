import { Box } from "../../../../shared/ui/primitives/box";
import { XIcon } from "../../../../shared/ui/primitives/icons/x-icon";
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
  } = useHeader();

  if (!walletConfigReady || hideAccountAndChainSelector || !isConnected) {
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
        {isConnected || isConnecting ? (
          <>
            {!hideChainSelector && <ChainModal />}
            <AccountModal />
          </>
        ) : null}
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
    </Box>
  );
};
