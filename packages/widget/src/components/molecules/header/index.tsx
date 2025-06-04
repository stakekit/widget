import { CaretLeftIcon } from "@sk-widget/components/atoms/icons/caret-left";
import { XIcon } from "@sk-widget/components/atoms/icons/x-icon";
import { useHeader } from "@sk-widget/components/molecules/header/use-header";
import { ConnectButton } from "@stakekit/rainbowkit";
import classNames from "clsx";
import { motion } from "motion/react";
import { Maybe } from "purify-ts";
import { Box } from "../../atoms/box";
import { AccountModal } from "../account-modal";
import { ChainModal } from "../chain-modal";
import { animationContainer, parentButton } from "./styles.css";

export const Header = () => {
  const {
    containerRef,
    wagmiConfig,
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

        {Maybe.fromFalsy(
          !wagmiConfig.isLoading && wagmiConfig.data && variant !== "zerion"
        )
          .map(() => (
            <ConnectButton.Custom>
              {({ account, chain, mounted }) => {
                return (
                  <Box
                    className={classNames({ [parentButton]: !mounted })}
                    aria-hidden={!mounted}
                  >
                    {Maybe.fromFalsy(
                      (isConnected || isConnecting) && chain && account
                    )
                      .map(() => (
                        <motion.div
                          className={animationContainer}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.2, duration: 0.2 }}
                        >
                          {!hideChainSelector && <ChainModal />}

                          <AccountModal />
                        </motion.div>
                      ))
                      .extractNullable()}
                  </Box>
                );
              }}
            </ConnectButton.Custom>
          ))
          .extractNullable()}
      </Box>
    </Box>
  );
};
