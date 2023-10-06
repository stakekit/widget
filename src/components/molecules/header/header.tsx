import { Text } from "../../atoms/typography";
import { Box } from "../../atoms/box";
import { Address } from "wagmi";
import { useLocation, useNavigate } from "react-router-dom";
import { CaretDownIcon, CaretLeftIcon, XIcon } from "../../atoms/icons";
import { useTranslation } from "react-i18next";
import { useLogout } from "../../../hooks";
import { ConnectButton, AvatarContext } from "@stakekit/rainbowkit";
import {
  avatarContainer,
  container,
  parentButton,
  titleStyle,
} from "./styles.css";
import classNames from "clsx";
import { isLedgerDappBrowserProvider } from "../../../utils";
import { useSKWallet } from "../../../hooks/wallet/use-sk-wallet";
import { useContext } from "react";
import { useWagmiConfig } from "../../../providers/wagmi";

const showDisconnect = isLedgerDappBrowserProvider();

export const Header = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const { isConnected, address } = useSKWallet();

  const wagmiConfig = useWagmiConfig();

  const { t } = useTranslation();

  const showBack = location.pathname !== "/";

  const onLeftIconPress = () => {
    showBack ? navigate(-1) : console.log("Support click");
  };

  const logout = useLogout();

  const onXPress = () => {
    if (isLedgerDappBrowserProvider()) return;

    logout();
  };

  const AvatarComponent = useContext(AvatarContext);

  return (
    <Box paddingTop="4" paddingBottom="1">
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Box hw="7">
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

        {!showDisconnect && (
          <Box display="flex" alignItems="center" justifyContent="center">
            <Box as="button" hw="5" onClick={onXPress}>
              <XIcon />
            </Box>
          </Box>
        )}
      </Box>

      {!wagmiConfig.isLoading && wagmiConfig.data && (
        <ConnectButton.Custom>
          {({ account, chain, openAccountModal, openChainModal, mounted }) => {
            return (
              <Box
                className={classNames({ [parentButton]: !mounted })}
                aria-hidden={!mounted}
                display="flex"
                justifyContent="center"
                gap="2"
              >
                {(() => {
                  if (!isConnected || !chain || !account) {
                    return <Text>{t("shared.stake_kit")}</Text>;
                  }

                  return (
                    <>
                      <Box
                        borderRadius="2xl"
                        background="backgroundMuted"
                        display="flex"
                        justifyContent="space-between"
                        alignItems="center"
                        className={container}
                        onClick={openChainModal}
                      >
                        {(() => {
                          if (chain.unsupported) {
                            return (
                              <Box
                                px="2"
                                py="2"
                                as="button"
                                onClick={openChainModal}
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
                                  <Box as="img" hw="6" src={chain.iconUrl} />
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
                        onClick={openAccountModal}
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
                    </>
                  );
                })()}
              </Box>
            );
          }}
        </ConnectButton.Custom>
      )}
    </Box>
  );
};
