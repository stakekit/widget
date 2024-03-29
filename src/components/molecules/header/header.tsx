import { Text } from "../../atoms/typography";
import { Box } from "../../atoms/box";
import { Address } from "wagmi";
import { useLocation, useNavigate } from "react-router-dom";
import { CaretDownIcon, CaretLeftIcon, XIcon } from "../../atoms/icons";
import { useTranslation } from "react-i18next";
import { useLogout } from "../../../hooks";
import { ConnectButton, AvatarContext } from "@stakekit/rainbowkit";
import {
  animationContainer,
  avatarContainer,
  container,
  parentButton,
  titleStyle,
} from "./styles.css";
import classNames from "clsx";
import { isLedgerDappBrowserProvider } from "../../../utils";
import { useContext, useMemo } from "react";
import { useWagmiConfig } from "../../../providers/wagmi";
import { useSKWallet } from "../../../providers/sk-wallet";
import { useTrackEvent } from "../../../hooks/tracking/use-track-event";
import { useSyncHeaderHeight } from "./use-sync-header-height";
import { motion } from "framer-motion";
import {
  isExternalProviderConnector,
  isLedgerLiveConnector,
} from "../../../providers/sk-wallet/utils";

export const Header = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const { containerRef } = useSyncHeaderHeight();

  const { isConnected, isConnecting, address, connector } = useSKWallet();

  const showDisconnect = useMemo(
    () =>
      connector &&
      !isExternalProviderConnector(connector) &&
      !isLedgerLiveConnector(connector),
    [connector]
  );

  const wagmiConfig = useWagmiConfig();

  const { t } = useTranslation();

  const showBack = location.pathname !== "/";

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

  const AvatarComponent = useContext(AvatarContext);

  return (
    <Box ref={containerRef}>
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

        {!wagmiConfig.isLoading && wagmiConfig.data && (
          <ConnectButton.Custom>
            {({
              account,
              chain,
              openAccountModal,
              openChainModal,
              mounted,
            }) => {
              return (
                <Box
                  className={classNames({ [parentButton]: !mounted })}
                  aria-hidden={!mounted}
                >
                  {(() => {
                    if ((!isConnected && !isConnecting) || !chain || !account) {
                      return null;
                    }

                    return (
                      <motion.div
                        className={animationContainer}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2, duration: 0.2 }}
                      >
                        <Box
                          borderRadius="2xl"
                          background="backgroundMuted"
                          display="flex"
                          justifyContent="space-between"
                          alignItems="center"
                          className={container}
                          onClick={() => {
                            trackEvent("chainModalOpened");
                            openChainModal();
                          }}
                        >
                          {(() => {
                            if (chain.unsupported) {
                              return (
                                <Box
                                  px="2"
                                  py="2"
                                  as="button"
                                  onClick={() => {
                                    trackEvent("chainModalOpened");
                                    openChainModal();
                                  }}
                                >
                                  <Text variant={{ type: "danger" }}>
                                    {t("shared.unsupported_network")}
                                  </Text>
                                </Box>
                              );
                            }

                            return (
                              <>
                                <Box
                                  as="button"
                                  display="flex"
                                  justifyContent="space-between"
                                  alignItems="center"
                                  paddingLeft="2"
                                  py="2"
                                >
                                  {chain?.iconUrl && (
                                    <Box
                                      as="img"
                                      borderRadius="full"
                                      hw="6"
                                      src={chain.iconUrl}
                                    />
                                  )}

                                  <Box marginLeft="2">
                                    <Text className={titleStyle}>
                                      {chain.name}
                                    </Text>
                                  </Box>

                                  <Box mx="2">
                                    <CaretDownIcon />
                                  </Box>
                                </Box>
                              </>
                            );
                          })()}
                        </Box>

                        <Box
                          borderRadius="2xl"
                          background="backgroundMuted"
                          display="flex"
                          justifyContent="space-between"
                          alignItems="center"
                          className={container}
                          onClick={() => {
                            trackEvent("accountModalOpened");
                            openAccountModal();
                          }}
                        >
                          {(() => {
                            return (
                              <>
                                <Box
                                  as="button"
                                  display="flex"
                                  justifyContent="space-between"
                                  alignItems="center"
                                  paddingLeft="2"
                                  py="2"
                                >
                                  {account.ensAvatar ? (
                                    <Box
                                      as="img"
                                      src={account.ensAvatar}
                                      hw="6"
                                      borderRadius="half"
                                    />
                                  ) : (
                                    <>
                                      <Box
                                        borderRadius="half"
                                        marginRight="2"
                                        className={avatarContainer}
                                      >
                                        <AvatarComponent
                                          address={address as Address}
                                          size={24}
                                        />
                                      </Box>

                                      <Text className={titleStyle}>
                                        {account.ensName ?? account.displayName}
                                      </Text>
                                    </>
                                  )}

                                  <Box mx="2">
                                    <CaretDownIcon />
                                  </Box>
                                </Box>
                              </>
                            );
                          })()}
                        </Box>
                      </motion.div>
                    );
                  })()}
                </Box>
              );
            }}
          </ConnectButton.Custom>
        )}
      </Box>
    </Box>
  );
};
