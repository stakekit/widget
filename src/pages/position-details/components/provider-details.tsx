import { RewardTypes, YieldDto } from "@stakekit/api-hooks";
import { Box, CaretDownIcon, Divider, Text } from "../../../components";
import { Image } from "../../../components/atoms/image";
import { ImageFallback } from "../../../components/atoms/image-fallback";
import { HelpModal } from "../../../index.package";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import { caretContainer, providerContainer, rotate180deg } from "../styles.css";
import { getRewardTypeFormatted } from "../../../utils/get-reward-type";
import { useEffect, useRef, useState } from "react";

export const ProviderDetails = ({
  stakeType,
  isFirst,
  integrationData,
  logo,
  name,
  rewardRate,
  rewardRateFormatted,
  rewardType,
  address,
}: {
  isFirst: boolean;
  stakeType: string;
  integrationData: YieldDto;
  logo: string;
  name: string;
  rewardRateFormatted: string;
  rewardRate: number;
  rewardType: RewardTypes;
  address?: string | undefined;
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const containerRef = useRef<HTMLDivElement>();
  const containerHeight = useRef<number>();

  useEffect(() => {
    containerHeight.current = containerRef.current?.scrollHeight;
  }, []);

  const { t } = useTranslation();

  const nameOrAddress = name ?? address ?? "";

  return (
    <Box display="flex" flexDirection="column">
      {isFirst && <Divider />}

      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Box
          my="1"
          display="flex"
          justifyContent="flex-start"
          alignItems="center"
        >
          <Box marginRight="2">
            <Image
              containerProps={{ hw: "8" }}
              imageProps={{ borderRadius: "full" }}
              src={logo}
              fallback={
                <Box marginRight="1">
                  <ImageFallback
                    name={nameOrAddress}
                    tokenLogoHw="8"
                    textVariant={{
                      type: "white",
                      weight: "bold",
                    }}
                  />
                </Box>
              }
            />
          </Box>

          <Text>
            {t("position_details.via", {
              stakeType,
              providerName: nameOrAddress,
            })}
          </Text>

          <HelpModal
            modal={{
              type: integrationData.metadata.type,
            }}
          />
        </Box>

        <Box
          flex={1}
          my="1"
          display="flex"
          justifyContent="flex-end"
          alignItems="center"
          onClick={() => setIsCollapsed((prev) => !prev)}
          as="button"
        >
          <Box
            display="flex"
            alignItems="center"
            justifyContent="flex-end"
            className={clsx([caretContainer, { [rotate180deg]: !isCollapsed }])}
          >
            <CaretDownIcon />
          </Box>
        </Box>
      </Box>

      <Box
        ref={containerRef}
        className={providerContainer}
        {...(containerHeight.current && {
          style: { maxHeight: isCollapsed ? 0 : containerHeight.current },
        })}
      >
        <Box
          marginTop="1"
          marginBottom="3"
          display="flex"
          justifyContent="space-between"
          alignItems="center"
        >
          <Text variant={{ weight: "normal" }}>
            {getRewardTypeFormatted(integrationData.rewardType)}
          </Text>

          <Text variant={{ type: "muted", weight: "normal" }}>
            {rewardRateFormatted}
          </Text>
        </Box>
      </Box>

      <Divider />
    </Box>
  );
};
