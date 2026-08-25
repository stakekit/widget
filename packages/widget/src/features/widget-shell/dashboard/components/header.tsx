import { ConnectButton } from "@stakekit/rainbowkit";
import classNames from "clsx";
import { Box } from "../../../../shared/ui/primitives/box";
import { XIcon } from "../../../../shared/ui/primitives/icons/x-icon";
import { AccountModal, ChainModal } from "../../../wallet/views";
import { parentButton } from "../../header/styles.css";
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
      <ConnectButton.Custom>
        {({ account, chain, mounted }) => {
          return (
            <Box
              className={classNames(middleItem, { [parentButton]: !mounted })}
              aria-hidden={!mounted}
              display="flex"
              alignItems="center"
              justifyContent="center"
              gap="2"
            >
              {(isConnected || isConnecting) && chain && account ? (
                <>
                  {!hideChainSelector && <ChainModal />}
                  <AccountModal />
                </>
              ) : null}
            </Box>
          );
        }}
      </ConnectButton.Custom>

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
