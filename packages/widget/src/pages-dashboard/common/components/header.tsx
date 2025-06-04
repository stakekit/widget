import { Box } from "@sk-widget/components/atoms/box";
import { XIcon } from "@sk-widget/components/atoms/icons/x-icon";
import { AccountModal } from "@sk-widget/components/molecules/account-modal";
import { ChainModal } from "@sk-widget/components/molecules/chain-modal";
import { parentButton } from "@sk-widget/components/molecules/header/styles.css";
import { useHeader } from "@sk-widget/components/molecules/header/use-header";
import {
  headerContainer,
  middleItem,
} from "@sk-widget/pages-dashboard/common/components/tabs/styles.css";
import { ConnectButton } from "@stakekit/rainbowkit";
import classNames from "clsx";
import { Maybe } from "purify-ts";

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

  if (wagmiConfig.isLoading || !wagmiConfig.data || hideAccountAndChainSelector)
    return null;

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
