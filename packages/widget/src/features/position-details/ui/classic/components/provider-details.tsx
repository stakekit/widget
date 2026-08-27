import { useTranslation } from "react-i18next";
import type { EarnYieldWithProvider } from "../../../../../domain/earn/models";
import { Box } from "../../../../../shared/ui/primitives/box";
import { PreferredIcon } from "../../../../../shared/ui/primitives/icons/preferred";
import { Text } from "../../../../../shared/ui/primitives/typography/text";
import { useMetaInfo } from "../../../../yield-entry/views";
import type { YieldSummaryProvider as ProviderDetailsModel } from "../../../../yield-summary/index";
import { inactiveContainer, noWrap } from "../styles.css";
import { PositionSourceDetails } from "./position-source-details";

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
  rewardType?: string | undefined;
}) => {
  const { t } = useTranslation();

  const nameOrAddress = providerDetails.name ?? providerDetails ?? "";
  const metaInfo = useMetaInfo({
    address: providerDetails.address,
    commission: providerDetails.commission,
    rewardRate: providerDetails.rewardRate,
    rewardType: providerDetails.rewardType,
    stakedBalance: providerDetails.stakedBalance,
    stakedBalanceToken: integrationData.token,
    votingPower: providerDetails.votingPower,
    website: providerDetails.website,
  });
  const metaEntries = Object.entries(metaInfo).filter(
    (
      entry
    ): entry is [
      keyof typeof metaInfo,
      NonNullable<(typeof metaInfo)[keyof typeof metaInfo]>,
    ] => !!entry[1]
  );

  return (
    <PositionSourceDetails
      hasDetails={metaEntries.length > 0}
      headerAccessory={
        <>
          {providerDetails.preferred ? (
            <Box marginLeft="1" display="flex">
              <PreferredIcon />
            </Box>
          ) : null}

          {providerDetails.status && providerDetails.status !== "active" ? (
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
          ) : null}
        </>
      }
      isFirst={isFirst}
      logo={logo}
      name={nameOrAddress}
      stakeType={stakeType}
    >
      {metaEntries.length > 0 ? (
        <Box marginTop="1">
          {metaEntries.map(([key, val]) => (
            <Box
              key={key}
              marginTop="1"
              marginBottom="3"
              display="flex"
              justifyContent="space-between"
              alignItems="center"
            >
              <Text variant={{ weight: "normal" }}>{val.title}</Text>

              {key === "address" && providerDetails.address ? (
                val.val
              ) : (
                <Text variant={{ type: "muted", weight: "normal" }}>
                  {val.val}
                </Text>
              )}
            </Box>
          ))}
        </Box>
      ) : null}
    </PositionSourceDetails>
  );
};
