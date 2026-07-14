import { ConnectButton } from "@stakekit/rainbowkit";
import { useTranslation } from "react-i18next";
import { useTrackEvent } from "../../../hooks/tracking/use-track-event";
import { useSettings } from "../../../providers/settings";
import { useSKWallet } from "../../../providers/wallet/react/use-wallet";
import { combineRecipeWithVariant } from "../../../utils/styles";
import { Box } from "../../atoms/box";
import { CaretDownIcon } from "../../atoms/icons/caret-down";
import { Text } from "../../atoms/typography/text";
import { container, titleStyle } from "./styles.css";

export const ChainModal = () => {
  const trackEvent = useTrackEvent();

  const { t } = useTranslation();

  const { chain: skChain } = useSKWallet();

  const { variant } = useSettings();

  return (
    <ConnectButton.Custom>
      {({ chain, openChainModal }) => {
        return chain && skChain ? (
          <Box
            data-rk="chain-modal-container"
            borderRadius="2xl"
            background="backgroundMuted"
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            className={combineRecipeWithVariant({
              variant,
              rec: container,
            })}
            onClick={() => {
              trackEvent("chainModalOpened");
              openChainModal();
            }}
          >
            {chain.unsupported && variant !== "zerion" ? (
              <Box px="2" py="2">
                <Text variant={{ type: "danger" }}>
                  {t("shared.unsupported_network")}
                </Text>
              </Box>
            ) : (
              <Box
                as="button"
                display="flex"
                justifyContent="space-between"
                alignItems="center"
                paddingLeft="2"
                py="2"
              >
                {chain.iconUrl && (
                  <Box
                    as="img"
                    borderRadius="full"
                    hw="6"
                    src={chain.iconUrl}
                  />
                )}

                {skChain.name && (
                  <>
                    <Box marginLeft="2">
                      <Text className={titleStyle}>{skChain.name}</Text>
                    </Box>

                    <Box mx="2">
                      <CaretDownIcon />
                    </Box>
                  </>
                )}
              </Box>
            )}
          </Box>
        ) : null;
      }}
    </ConnectButton.Custom>
  );
};
