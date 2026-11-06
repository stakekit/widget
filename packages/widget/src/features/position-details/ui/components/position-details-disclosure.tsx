import { useTranslation } from "react-i18next";

import { getExtendedYieldType } from "../../../../domain/earn/yield";
import { formatTokenAmount } from "../../../../shared/lib/number-format";
import { useWidgetPresentation } from "../../../../shared/react/widget-presentation";
import {
  Button,
  DetailList,
  DetailRow,
  Disclosure,
  Stack,
  Text,
} from "../../../../ui/index";
import { RewardRateBreakdown } from "../../../yield-summary/views";
import { usePositionDetails } from "../../react/use-position-details";
import { usePositionOverview } from "../../react/use-position-overview";
import { ProviderDetails } from "./provider-details";

/**
 * Everything about the position itself the summary card does not show,
 * under one "Details", open at first: the balance breakdown, its Shares and
 * rewards, the reward rate's composition and the validators it is staked
 * with. The yield's facts follow in `PositionYieldFacts`.
 */
export const PositionDetailsDisclosure = () => {
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();
  const positionDetails = usePositionDetails();
  const overview = usePositionOverview();
  const { integrationData, personalizedRewardRate } = positionDetails;

  if (positionDetails.isLoading || !overview || !integrationData) return null;

  const conversions = [...(positionDetails.shareToAmountConversions ?? [])];
  const stakeType = t(
    `position_details.stake_type.${getExtendedYieldType(integrationData)}`
  );

  return (
    <Disclosure
      title={t("position_details.details")}
      testId="position-details-disclosure"
      defaultOpen
    >
      <Stack gap={16}>
        <DetailList>
          {overview.breakdownRows.map((row) => (
            <DetailRow
              key={row.id}
              label={row.label}
              value={row.value}
              tone={row.tone}
              {...(row.subValue ? { caption: row.subValue } : {})}
            />
          ))}
          {overview.detailRows.map((row) => (
            <DetailRow key={row.id} label={row.label} value={row.value} />
          ))}
        </DetailList>

        {positionDetails.hasHiddenBalances ? (
          <Stack gap={4}>
            <Button
              size="sm"
              loading={positionDetails.revealing}
              onClick={positionDetails.onRevealBalances}
            >
              {t("shared.confidential.reveal")}
            </Button>
            {positionDetails.revealFailed ? (
              <Text tone="danger">
                {t("shared.confidential.reveal_failed")}
              </Text>
            ) : null}
          </Stack>
        ) : null}
        {positionDetails.hasRevealedBalances ? (
          <Button size="sm" onClick={positionDetails.onHideBalances}>
            {t("shared.confidential.hide")}
          </Button>
        ) : null}

        {conversions.length > 0 ? (
          <Stack gap={4}>
            {conversions.map(([tokenKey, conversion]) => (
              <Text tone="muted" numeric key={tokenKey}>
                {`1 ${conversion.symbol} = ${formatTokenAmount(conversion.rate, locale, "nearest")} ${conversion.shareSymbol}`}
              </Text>
            ))}
          </Stack>
        ) : null}

        <RewardRateBreakdown
          rewardRate={positionDetails.apyCompositionRewardRate}
          showUpToCampaign={positionDetails.apyCompositionShowsUpToCampaign}
          title={t("details.apy_composition.title")}
          testId={
            personalizedRewardRate
              ? "personalized-reward-rate-breakdown"
              : "reward-rate-breakdown"
          }
        />

        {positionDetails.positionSource === "validator" ? (
          <Stack>
            {positionDetails.providersDetails?.map((provider, index) => (
              <ProviderDetails
                {...provider}
                key={provider.address ?? index}
                isFirst={index === 0}
                rewardRate={
                  personalizedRewardRate ? undefined : provider.rewardRate
                }
                rewardType={
                  personalizedRewardRate ? undefined : provider.rewardType
                }
                stakeType={stakeType}
                integrationData={integrationData}
              />
            ))}
          </Stack>
        ) : null}
      </Stack>
    </Disclosure>
  );
};
