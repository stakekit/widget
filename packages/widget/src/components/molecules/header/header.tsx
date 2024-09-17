import { shouldShowDisconnect } from "@sk-widget/domain/types/connectors";
import { useUnderMaintenance } from "@sk-widget/hooks/use-under-maintenance";
import { ConnectButton } from "@stakekit/rainbowkit";
import classNames from "clsx";
import { motion } from "framer-motion";
import { Maybe } from "purify-ts";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useLogout } from "../../../hooks";
import { useDetailsMatch } from "../../../hooks/navigation/use-details-match";
import { useTrackEvent } from "../../../hooks/tracking/use-track-event";
import { useSettings } from "../../../providers/settings";
import { useSKWallet } from "../../../providers/sk-wallet";
import { useWagmiConfig } from "../../../providers/wagmi";
import { Box } from "../../atoms/box";
import { CaretLeftIcon, XIcon } from "../../atoms/icons";
import { AccountModal } from "../account-modal";
import { ChainModal } from "../chain-modal";
import { animationContainer, parentButton } from "./styles.css";
import { useSyncHeaderHeight } from "./use-sync-header-height";

export const Header = () => {
  const navigate = useNavigate();
  const underMaintenance = useUnderMaintenance();

  const { containerRef } = useSyncHeaderHeight();

  const { variant } = useSettings();

  const { isConnected, isConnecting, connector } = useSKWallet();

  const showDisconnect = useMemo(
    () =>
      Maybe.fromNullable(connector).map(shouldShowDisconnect).orDefault(false),
    [connector]
  );

  const wagmiConfig = useWagmiConfig();

  const showBack = !useDetailsMatch();

  const trackEvent = useTrackEvent();

  const onLeftIconPress = () => {
    if (!showBack) return;

    trackEvent("backClicked");
    navigate(-1);
  };

  const { mutate: logout } = useLogout();

  const onXPress = () => {
    trackEvent("widgetDisconnectClicked");
    logout();
  };

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

          {showDisconnect && !underMaintenance && (
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
                      (isConnected || isConnecting) &&
                        chain &&
                        account &&
                        !underMaintenance
                    )
                      .map(() => (
                        <motion.div
                          className={animationContainer}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.2, duration: 0.2 }}
                        >
                          <ChainModal />

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
