import { RewardTypes, YieldDto } from "@stakekit/api-hooks";
import { Box, CaretDownIcon, Divider, Text } from "../../../components";
import { Image } from "../../../components/atoms/image";
import { ImageFallback } from "../../../components/atoms/image-fallback";
import { HelpModal } from "../../../index.package";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import {
  addressHover,
  addressParent,
  caretContainer,
  inactiveContainer,
  noWrap,
  providerContainer,
  rotate180deg,
} from "../styles.css";
import { memo, useEffect, useRef, useState } from "react";
import { useMetaInfo } from "../../../components/molecules/select-validator/meta-info";
import { useProvidersDetails } from "../../../hooks/use-provider-details";
import { GetMaybeJust } from "../../../types";
import * as CopyText from "../../../components/atoms/copy-text";
import { PreferredIcon } from "../../../components/atoms/icons/preferred";

export const ProviderDetails = ({
  stakeType,
  isFirst,
  integrationData,
  logo,
  ...providerDetails
}: {
  isFirst: boolean;
  stakeType: string;
  integrationData: YieldDto;
  logo: string;
  name: string;
  rewardRateFormatted: string;
  rewardRate: number;
  rewardType: RewardTypes;
} & GetMaybeJust<ReturnType<typeof useProvidersDetails>>[0]) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const containerRef = useRef<HTMLDivElement>();
  const containerHeight = useRef<number>();

  useEffect(() => {
    containerHeight.current = containerRef.current?.scrollHeight;
  }, []);

  const { t } = useTranslation();

  const nameOrAddress = providerDetails.name ?? providerDetails ?? "";

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
                    textVariant={{ type: "white", weight: "bold" }}
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

          {providerDetails.preferred && (
            <Box marginLeft="1" display="flex">
              <PreferredIcon />
            </Box>
          )}

          <HelpModal
            modal={{
              type: integrationData.metadata.type,
            }}
          />

          {providerDetails.status && providerDetails.status !== "active" && (
            <Box marginLeft="1" className={inactiveContainer}>
              <Text
                variant={{
                  type: "white",
                  weight: "medium",
                  size: "small",
                }}
                className={noWrap}
              >
                {t(
                  providerDetails.status === "jailed"
                    ? "details.validators_jailed"
                    : "details.validators_inactive"
                )}
              </Text>
            </Box>
          )}
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
        <ValidatorMeta
          address={providerDetails.address}
          commission={providerDetails.commission}
          rewardRate={providerDetails.rewardRate}
          stakedBalance={providerDetails.stakedBalance}
          votingPower={providerDetails.votingPower}
          rewardType={providerDetails.rewardType}
          website={providerDetails.website}
          stakedBalanceToken={integrationData.token}
        />
      </Box>

      <Divider />
    </Box>
  );
};

const ValidatorMeta = memo((props: Parameters<typeof useMetaInfo>[0]) => {
  const metaInfo = useMetaInfo(props);

  return (
    <Box marginTop="2">
      {Object.entries(metaInfo)
        .filter(
          (val): val is [keyof typeof metaInfo, NonNullable<(typeof val)[1]>] =>
            !!val[1]
        )
        .map(([key, val]) => {
          return (
            <Box
              key={key}
              marginTop="1"
              marginBottom="3"
              display="flex"
              justifyContent="space-between"
              alignItems="center"
            >
              <Text variant={{ weight: "normal" }}>{val.title}</Text>

              {key === "address" && props.address ? (
                <CopyText.Provider text={props.address}>
                  <CopyText.Root>
                    <Box display="flex" gap="1" className={addressParent}>
                      <Text
                        variant={{ type: "muted", weight: "normal" }}
                        className={addressHover}
                      >
                        {val.val}
                      </Text>

                      <CopyText.AnimatedContent>
                        <Box
                          display="flex"
                          alignItems="center"
                          justifyContent="center"
                        >
                          <CopyText.Icons hw={16} />
                        </Box>
                      </CopyText.AnimatedContent>
                    </Box>
                  </CopyText.Root>
                </CopyText.Provider>
              ) : (
                <Text variant={{ type: "muted", weight: "normal" }}>
                  {val.val}
                </Text>
              )}
            </Box>
          );
        })}
    </Box>
  );
});
