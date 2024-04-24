import type { RewardTypes, YieldDto } from "@stakekit/api-hooks";
import { Box, Divider, Text } from "../../../components";
import { Image } from "../../../components/atoms/image";
import { ImageFallback } from "../../../components/atoms/image-fallback";
import { HelpModal } from "../../../index.package";
import { useTranslation } from "react-i18next";
import {
  addressHover,
  addressParent,
  inactiveContainer,
  noWrap,
} from "../styles.css";
import { memo } from "react";
import { useMetaInfo } from "../../../components/molecules/select-validator/meta-info";
import type { useProvidersDetails } from "../../../hooks/use-provider-details";
import type { GetMaybeJust } from "../../../types";
import * as CopyText from "../../../components/atoms/copy-text";
import { PreferredIcon } from "../../../components/atoms/icons/preferred";
import {
  CollapsibleArrow,
  CollapsibleContent,
  CollapsibleRoot,
  CollapsibleTrigger,
} from "../../../components/atoms/collapsible";

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
  const { t } = useTranslation();

  const nameOrAddress = providerDetails.name ?? providerDetails ?? "";

  return (
    <>
      <CollapsibleRoot>
        <Box display="flex" flexDirection="column">
          {isFirst && <Divider />}

          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            my="2"
          >
            <Box display="flex" justifyContent="flex-start" alignItems="center">
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

              <HelpModal modal={{ type: integrationData.metadata.type }} />

              {providerDetails.status &&
                providerDetails.status !== "active" && (
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

            <CollapsibleTrigger flex={1} justifyContent="flex-end">
              <CollapsibleArrow />
            </CollapsibleTrigger>
          </Box>

          <CollapsibleContent>
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
          </CollapsibleContent>

          <Divider />
        </Box>
      </CollapsibleRoot>
    </>
  );
};

const ValidatorMeta = memo((props: Parameters<typeof useMetaInfo>[0]) => {
  const metaInfo = useMetaInfo(props);

  return (
    <Box marginTop="1">
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
