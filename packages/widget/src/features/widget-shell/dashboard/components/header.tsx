import { ConnectButton } from "@stakekit/rainbowkit";
import classNames from "clsx";
import { Box } from "../../../../shared/ui/primitives/box";
import { XIcon } from "../../../../shared/ui/primitives/icons/x-icon";
import { AccountModal, ChainModal } from "../../../wallet";
import { parentButton } from "../../header/styles.css";
import { useHeader } from "../../header/use-header";
import { headerContainer, middleItem } from "./styles.css";

export const Header = () => {
  const {
    onXPress,
    walletRuntime,
    hideChainSelector,
    isConnected,
    isConnecting,
    showDisconnect,
    containerRef,
    hideAccountAndChainSelector,
  } = useHeader();

  if (
    walletRuntime.isLoading ||
    !walletRuntime.data ||
    hideAccountAndChainSelector ||
    !isConnected
  ) {
    return null;
  }

  return (
    <Box ref={containerRef} data-rk="header" className={headerContainer}>
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
