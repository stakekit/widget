import { Box } from "../../atoms/box";
import { useNavigate } from "react-router-dom";
import { CaretLeftIcon, XIcon } from "../../atoms/icons";
import { useLogout } from "../../../hooks";
import { ConnectButton } from "@stakekit/rainbowkit";
import { animationContainer, parentButton } from "./styles.css";
import classNames from "clsx";
import { isLedgerDappBrowserProvider } from "../../../utils";
import { useWagmiConfig } from "../../../providers/wagmi";
import { useSKWallet } from "../../../providers/sk-wallet";
import { useTrackEvent } from "../../../hooks/tracking/use-track-event";
import { useSyncHeaderHeight } from "./use-sync-header-height";
import { motion } from "framer-motion";
import { isExternalProviderConnector } from "../../../providers/external-provider";
import { isLedgerLiveConnector } from "../../../providers/ledger/ledger-live-connector-meta";
import { ChainModal } from "../chain-modal";
import { AccountModal } from "../account-modal";
import { Maybe } from "purify-ts";
import { useMemo } from "react";
import { useSettings } from "../../../providers/settings";
import { useDetailsMatch } from "../../../hooks/navigation/use-details-match";

export const Header = () => {
  const navigate = useNavigate();

  const { containerRef } = useSyncHeaderHeight();

  const { variant } = useSettings();

  const { isConnected, isConnecting, connector } = useSKWallet();

  const showDisconnect = useMemo(
    () =>
      connector &&
      !isExternalProviderConnector(connector) &&
      !isLedgerLiveConnector(connector),
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

  const { mutateAsync: logout } = useLogout();

  const onXPress = () => {
    trackEvent("widgetDisconnectClicked");
    if (isLedgerDappBrowserProvider()) return;

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
