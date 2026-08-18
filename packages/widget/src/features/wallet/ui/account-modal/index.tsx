import {
  AvatarContext,
  ConnectButton,
  type AvatarComponent as RainbowKitAvatarComponent,
} from "@stakekit/rainbowkit";
import { useContext } from "react";
import type { Address } from "viem";
import { useWidgetConfig } from "../../../../features/widget-configuration/index";
import { combineRecipeWithVariant } from "../../../../shared/styles/recipe-variant";
import { Box } from "../../../../shared/ui/primitives/box";
import { CaretDownIcon } from "../../../../shared/ui/primitives/icons/caret-down";
import { Text } from "../../../../shared/ui/primitives/typography/text";
import { useTrackEvent } from "../../../tracking/index";
import { useSKWallet } from "../../react/use-wallet";
import { avatarContainer, container, titleStyle } from "./styles.css";

export const AccountModal = () => {
  const trackEvent = useTrackEvent();

  const { address } = useSKWallet();

  const variant = useWidgetConfig("variant");

  const AvatarComponent = useContext(
    AvatarContext
  ) as RainbowKitAvatarComponent | null;

  return (
    <ConnectButton.Custom>
      {({ account, openAccountModal }) =>
        account && address ? (
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
                    {AvatarComponent && (
                      <AvatarComponent address={address as Address} size={24} />
                    )}
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
          </Box>
        ) : null
      }
    </ConnectButton.Custom>
  );
};
