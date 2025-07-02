import { AvatarContext, ConnectButton } from "@stakekit/rainbowkit";
import { Maybe } from "purify-ts";
import { useContext } from "react";
import type { Address } from "viem";
import { useTrackEvent } from "../../../hooks/tracking/use-track-event";
import { useSKWallet } from "../../../providers/sk-wallet";
import { Box, CaretDownIcon, Text } from "../..";
import { avatarContainer, container, titleStyle } from "./styles.css";

export const AccountModal = () => {
  const trackEvent = useTrackEvent();

  const { address } = useSKWallet();

  const AvatarComponent = useContext(AvatarContext);

  return (
    <ConnectButton.Custom>
      {({ account, openAccountModal }) =>
        Maybe.fromNullable(account)
          .map((a) => (
            <Box
              data-rk="account-modal-container"
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
              <Box
                as="button"
                display="flex"
                justifyContent="space-between"
                alignItems="center"
                paddingLeft="2"
                py="2"
              >
                {a.ensAvatar ? (
                  <Box as="img" src={a.ensAvatar} hw="6" borderRadius="half" />
                ) : (
                  <>
                    <Box
                      borderRadius="half"
                      marginRight="2"
                      className={avatarContainer}
                    >
                      {AvatarComponent && (
                        <AvatarComponent
                          address={address as Address}
                          size={24}
                        />
                      )}
                    </Box>

                    <Text className={titleStyle}>
                      {a.ensName ?? a.displayName}
                    </Text>
                  </>
                )}

                <Box mx="2">
                  <CaretDownIcon />
                </Box>
              </Box>
            </Box>
          ))
          .extractNullable()
      }
    </ConnectButton.Custom>
  );
};
