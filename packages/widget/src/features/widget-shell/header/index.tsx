import { ConnectButton } from "@stakekit/rainbowkit";
import classNames from "clsx";
import { motion } from "motion/react";
import { Box } from "../../../shared/ui/primitives/box";
import { CaretLeftIcon } from "../../../shared/ui/primitives/icons/caret-left";
import { XIcon } from "../../../shared/ui/primitives/icons/x-icon";
import { AccountModal, ChainModal } from "../../wallet";
import { animationContainer, parentButton } from "./styles.css";
import { useHeader } from "./use-header";

export const Header = () => {
  const {
    containerRef,
    walletConfig,
    variant,
    hideChainSelector,
    isConnected,
    showBack,
    onLeftIconPress,
    showDisconnect,
    onXPress,
    isConnecting,
  } = useHeader();

  return (
    <Box ref={containerRef} data-rk="header">
      <Box paddingTop="4" paddingBottom="1">
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box
            hw="7"
            display="flex"
            alignItems="center"
            justifyContent="center"
          >
            {showBack ? (
              <Box
                as="button"
                onClick={onLeftIconPress}
                display="flex"
                alignItems="center"
                justifyContent="center"
              >
                <CaretLeftIcon />
              </Box>
            ) : (
              <Box />
            )}
          </Box>

          {showDisconnect && (
            <Box
              as="button"
              onClick={onXPress}
              display="flex"
              alignItems="center"
              justifyContent="center"
            >
              <XIcon hw={24} />
            </Box>
          )}
        </Box>

        {!walletConfig.isLoading &&
        walletConfig.data &&
        variant !== "zerion" ? (
          <ConnectButton.Custom>
            {({ account, chain, mounted }) => {
              return (
                <Box
                  className={classNames({ [parentButton]: !mounted })}
                  aria-hidden={!mounted}
                >
                  {(isConnected || isConnecting) && chain && account ? (
                    <motion.div
                      className={animationContainer}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.2, duration: 0.2 }}
                    >
                      {!hideChainSelector && <ChainModal />}

                      <AccountModal />
                    </motion.div>
                  ) : null}
                </Box>
              );
            }}
          </ConnectButton.Custom>
        ) : null}
      </Box>
    </Box>
  );
};
