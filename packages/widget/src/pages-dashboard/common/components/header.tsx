import { ConnectButton } from "@stakekit/rainbowkit";
import classNames from "clsx";
import { Maybe } from "purify-ts";
import { Box } from "../../../components/atoms/box";
import { XIcon } from "../../../components/atoms/icons/x-icon";
import { AccountModal } from "../../../components/molecules/account-modal";
import { ChainModal } from "../../../components/molecules/chain-modal";
import { parentButton } from "../../../components/molecules/header/styles.css";
import { useHeader } from "../../../components/molecules/header/use-header";
import { headerContainer, middleItem } from "./tabs/styles.css";

export const Header = () => {
  const {
    onXPress,
    wagmiConfig,
    hideChainSelector,
    isConnected,
    isConnecting,
    showDisconnect,
    containerRef,
    hideAccountAndChainSelector,
  } = useHeader();

  if (
    wagmiConfig.isLoading ||
    !wagmiConfig.data ||
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
              {Maybe.fromFalsy(
                (isConnected || isConnecting) && chain && account
              )
                .map(() => (
                  <>
                    {!hideChainSelector && <ChainModal />}

                    <AccountModal />
                  </>
                ))
                .extractNullable()}
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
