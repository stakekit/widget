import { useTranslation } from "react-i18next";
import type { EarnYieldWithProvider } from "../../../../../domain/earn/models";
import {
  Badge,
  DetailList,
  DetailRow,
  ExternalLink,
  Icon,
} from "../../../../../ui/index";
import { useMetaInfo } from "../../../../yield-entry/views";
import type { YieldSummaryProvider as ProviderDetailsModel } from "../../../../yield-summary/index";
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
  rewardType?: string | undefined;
}) => {
  const { t } = useTranslation();

  const nameOrAddress = providerDetails.name ?? providerDetails.address ?? "";
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
  const metaEntries = Object.entries(metaInfo).flatMap(([key, entry]) =>
    entry ? [{ key, entry }] : []
  );
  const inactive =
    providerDetails.status && providerDetails.status !== "active";

  return (
    <PositionSourceDetails
      hasDetails={metaEntries.length > 0}
      headerAccessory={
        providerDetails.preferred || inactive ? (
          <>
            {providerDetails.preferred ? (
              <Icon name="PreferredIcon" size="sm" />
            ) : null}
            {inactive ? (
              <Badge tone="danger">
                {t(
                  providerDetails.status === "jailed"
                    ? "details.validators_jailed"
                    : "details.validators_inactive"
                )}
              </Badge>
            ) : null}
          </>
        ) : undefined
      }
      isFirst={isFirst}
      logo={logo}
      name={nameOrAddress}
      stakeType={stakeType}
    >
      <DetailList>
        {metaEntries.map(({ key, entry }) => (
          <DetailRow
            key={key}
            label={entry.title}
            value={
              entry.href ? (
                <ExternalLink
                  href={entry.href}
                  newTabLabel={t("shared.opens_in_new_tab")}
                >
                  {entry.val}
                </ExternalLink>
              ) : (
                entry.val
              )
            }
            {...(entry.copyValue
              ? {
                  copyable: {
                    value: entry.copyValue,
                    label: t("position_details.copy_address", {
                      label: entry.title,
                    }),
                    copiedLabel: t("position_details.copied"),
                  },
                }
              : {})}
          />
        ))}
      </DetailList>
    </PositionSourceDetails>
  );
};
