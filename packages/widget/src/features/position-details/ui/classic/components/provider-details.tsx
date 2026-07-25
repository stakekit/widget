import { memo } from "react";
import { useTranslation } from "react-i18next";
import type { EarnYieldWithProvider } from "../../../../../domain/schema/earn-models";
import { Box } from "../../../../../shared/ui/primitives/box";
import { PreferredIcon } from "../../../../../shared/ui/primitives/icons/preferred";
import { Image } from "../../../../../shared/ui/primitives/image";
import { Text } from "../../../../../shared/ui/primitives/typography/text";
import { useMetaInfo } from "../../../../earn/ui/components/select-validator/meta-info";
import { Divider } from "../../../../widget-shell/divider";
import {
  CollapsibleArrow,
  CollapsibleContent,
  CollapsibleRoot,
  CollapsibleTrigger,
} from "../../../../widget-shell/ui/collapsible";
import type { YieldSummaryProvider as ProviderDetailsModel } from "../../../../yield-summary";
import { inactiveContainer, noWrap } from "../styles.css";

export const ProviderDetails = ({
  stakeType,
  isFirst,
  integrationData,
  logo,
  ...providerDetails
}: Omit<ProviderDetailsModel, "rewardType"> & {
  isFirst: boolean;
  stakeType: string;
  integrationData: EarnYieldWithProvider;
  logo: string | undefined;
  name: string;
  rewardRateFormatted: string;
  rewardRate: number | undefined;
  rewardType?: string | undefined;
}) => {
  const { t } = useTranslation();

  const nameOrAddress = providerDetails.name ?? providerDetails ?? "";

  return (
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
                wrapperProps={{ hw: "8" }}
                imgProps={{ borderRadius: "full" }}
                src={logo}
                fallbackName={nameOrAddress}
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
                val.val
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
