import { AvatarContext, ConnectButton } from "@stakekit/rainbowkit";
import { Maybe } from "purify-ts";
import { useContext } from "react";
import type { Address } from "viem";
import { useTrackEvent } from "../../../hooks/tracking/use-track-event";
import { useSettings } from "../../../providers/settings";
import { useSKWallet } from "../../../providers/sk-wallet";
import { combineRecipeWithVariant } from "../../../utils/styles";
import { Box } from "../../atoms/box";
import { CaretDownIcon } from "../../atoms/icons/caret-down";
import { Text } from "../../atoms/typography/text";
import { avatarContainer, container, titleStyle } from "./styles.css";

export const AccountModal = () => {
  const trackEvent = useTrackEvent();

  const { address } = useSKWallet();

  const { variant } = useSettings();

  const AvatarComponent = useContext(AvatarContext);

  return (
    <ConnectButton.Custom>
      {({ account, openAccountModal }) =>
        Maybe.fromRecord({
          account: Maybe.fromNullable(account),
          address: Maybe.fromNullable(address),
        })
          .map((a) => (
            <Box
              data-rk="account-modal-container"
              borderRadius="2xl"
              background="backgroundMuted"
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              className={combineRecipeWithVariant({ variant, rec: container })}
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
                {a.account.ensAvatar ? (
                  <Box
                    as="img"
                    src={a.account.ensAvatar}
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
                      {AvatarComponent && (
                        <AvatarComponent
                          address={address as Address}
                          size={24}
                        />
                      )}
                    </Box>

                    <Text className={titleStyle}>
                      {a.account.ensName ?? a.account.displayName}
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
