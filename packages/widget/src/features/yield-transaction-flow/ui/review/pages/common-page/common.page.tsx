import type { ComponentProps, ReactNode } from "react";
import { Trans, useTranslation } from "react-i18next";
import type { EarnYieldWithProvider } from "../../../../../../domain/earn/models";
import type { Token } from "../../../../../../domain/token/token";
import { Divider } from "../../../../../../shared/ui/components/divider";
import { ToolTip } from "../../../../../../shared/ui/components/tooltip";
import { Box } from "../../../../../../shared/ui/primitives/box";
import { ContentLoaderSquare } from "../../../../../../shared/ui/primitives/content-loader";
import { InfoIcon } from "../../../../../../shared/ui/primitives/icons/info";
import { Text } from "../../../../../../shared/ui/primitives/typography/text";
import { WarningBox } from "../../../../../../shared/ui/primitives/warning-box";
import { useTrackEvent } from "../../../../../tracking/index";
import { useWidgetConfig } from "../../../../../widget-configuration/index";
import {
  AnimationPage,
  PageContainer,
  type PageCta,
  PageCtaButton,
} from "../../../../../widget-shell/views";
import {
  KycGateCard,
  MetaInfo,
  type RewardTokenDetails,
} from "../../../../../yield-summary/views";
import type { FeesBps } from "../../types";
import { feeStyles, pointerStyles } from "../style.css";
import ReviewTopSection from "./components/review-top-section";

export type MetaInfoProps =
  | { showMetaInfo: true; metaInfoProps: ComponentProps<typeof MetaInfo> }
  | { showMetaInfo: false; metaInfoProps?: never };

type ReviewPageProps = {
  facts?: ComponentProps<typeof ReviewTopSection>["facts"];
  fee: string;
  title: string;
  token: Token | null;
  metadata: ComponentProps<typeof ReviewTopSection>["metadata"];
  info: ReactNode;
  rewardTokenDetailsProps: ComponentProps<typeof RewardTokenDetails> | null;
  estimatedRewardAmounts?: {
    earnYearly: string;
    earnMonthly: string;
  } | null;
  isGasCheckError: boolean;
  loading?: boolean;
  depositFee: FeesBps | null;
  managementFee: FeesBps | null;
  performanceFee: FeesBps | null;
  commissionFee: string | null;
  kyc?: ComponentProps<typeof KycGateCard>;
  feeConfigLoading?: boolean;
  cta: PageCta;
} & MetaInfoProps;

type PositionActionReview = {
  readonly amount: string;
  readonly cta: PageCta;
  readonly facts: ReviewPageProps["facts"];
  readonly fee: string;
  readonly gasCheckLoading: boolean;
  readonly integrationData: EarnYieldWithProvider;
  readonly isGasCheckWarning: boolean;
  readonly rewardTokenDetailsProps: ReviewPageProps["rewardTokenDetailsProps"];
  readonly title: string;
  readonly token: Token;
};

/** Review props for acting on a held position, where no entry fees apply. */
export const getPositionActionReviewProps = (review: PositionActionReview) => ({
  commissionFee: null,
  cta: review.cta,
  depositFee: null,
  facts: review.facts,
  fee: review.fee,
  feeConfigLoading: false,
  info: `${review.amount} ${review.token.symbol}`,
  isGasCheckError: review.isGasCheckWarning,
  loading: review.gasCheckLoading,
  managementFee: null,
  metadata: {
    logoURI: review.integrationData.metadata.logoURI,
    name: review.integrationData.metadata.name,
    provider: review.integrationData.provider,
  },
  performanceFee: null,
  rewardTokenDetailsProps: review.rewardTokenDetailsProps,
  title: review.title,
  token: review.token,
});

export const ReviewPage = ({
  facts,
  fee,
  title,
  token,
  metadata,
  info,
  rewardTokenDetailsProps,
  estimatedRewardAmounts,
  isGasCheckError,
  loading = false,
  depositFee,
  managementFee,
  performanceFee,
  feeConfigLoading = false,
  commissionFee,
  kyc,
  cta,
  ...rest
}: ReviewPageProps) => {
  const trackEvent = useTrackEvent();
  const { t } = useTranslation();
  const hideGasFee = useWidgetConfig("hideGasFee");

  const isLoading = loading || feeConfigLoading;
  const configFees = isLoading
    ? []
    : [depositFee, managementFee, performanceFee].filter(
        (configFee) => configFee !== null
      );
  // Hiding the gas estimate can leave no fee to show once fees have loaded.
  const showFees =
    !hideGasFee || isLoading || !!commissionFee || configFees.length > 0;

  return (
    <AnimationPage>
      <PageContainer>
        <ReviewTopSection
          facts={facts}
          info={info}
          metadata={metadata}
          rewardTokenDetailsProps={rewardTokenDetailsProps}
          estimatedRewardAmounts={estimatedRewardAmounts}
          title={title}
          token={token}
        />

        {kyc && (kyc.gate.state !== "pass" || kyc.isChecking) && (
          <Box marginTop="4">
            <KycGateCard {...kyc} />
          </Box>
        )}

        {showFees && (
          <>
            <Divider />

            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              marginTop="4"
            >
              <Text variant={{ weight: "semibold" }}>{t("shared.fees")}</Text>
            </Box>

            {hideGasFee ? null : (
              <GasFee
                label={t("review.estimated_gas_fee")}
                price={fee}
                loading={isLoading}
              />
            )}

            {hideGasFee && isLoading ? (
              <Box marginTop="2" marginBottom="2" height="4" width="40">
                <ContentLoaderSquare
                  heightPx={16}
                  variant={{ size: "medium" }}
                />
              </Box>
            ) : null}

            {commissionFee ? (
              <CommissionFee commissionFee={commissionFee} />
            ) : null}

            {configFees.map((configFee) => (
              <ConfigFee key={configFee.label} feesBps={configFee} />
            ))}
          </>
        )}

        {isGasCheckError && (
          <Box marginBottom="2">
            <WarningBox text="This action is unlikely to succeed due to insufficient funds to cover gas fees" />
          </Box>
        )}

        <Divider />

        {rest.showMetaInfo && (
          <>
            <Box marginBottom="4">
              <Box my="4">
                <Text variant={{ weight: "semibold" }}>
                  {t("review.additional_info")}
                </Text>
              </Box>

              <MetaInfo {...rest.metaInfoProps} />
            </Box>

            <Divider />
          </>
        )}

        <Box marginTop="4" marginBottom="4">
          <Text variant={{ weight: "normal", type: "muted" }}>
            <Trans
              i18nKey="review.terms_of_use"
              components={{
                underline0: (
                  // biome-ignore lint: false
                  <a
                    target="_blank"
                    onClick={() => trackEvent("termsClicked")}
                    href="https://docs.yield.xyz/docs/terms-of-use"
                    className={pointerStyles}
                    rel="noreferrer"
                  />
                ),
              }}
            />
          </Text>
        </Box>

        <PageCtaButton cta={cta} />
      </PageContainer>
    </AnimationPage>
  );
};

const GasFee = ({
  label,
  price,
  loading,
}: {
  label: string;
  price: string;
  loading: boolean;
}) => {
  return (
    <Box
      display="flex"
      justifyContent="space-between"
      alignItems="center"
      marginTop="2"
      marginBottom="2"
      data-testid="estimated_gas_fee"
      height="4"
    >
      <Text variant={{ weight: "normal", type: "muted" }}>{label}</Text>
      {loading ? (
        <Box width="40">
          <ContentLoaderSquare heightPx={16} variant={{ size: "medium" }} />
        </Box>
      ) : (
        <Text
          className={feeStyles}
          variant={{ type: "muted", weight: "normal" }}
        >
          {price}
        </Text>
      )}
    </Box>
  );
};

const CommissionFee = ({ commissionFee }: { commissionFee: string }) => {
  const { t } = useTranslation();
  return (
    <Box
      display="flex"
      justifyContent="space-between"
      alignItems="center"
      marginTop="2"
      marginBottom="2"
      data-testid="commission_fee"
      height="4"
    >
      <Text variant={{ weight: "normal", type: "muted" }}>
        {t("review.staking_fee")}
      </Text>

      <Text className={feeStyles} variant={{ type: "muted", weight: "normal" }}>
        {commissionFee}
      </Text>
    </Box>
  );
};

const ConfigFee = ({ feesBps }: { feesBps: FeesBps }) => {
  return (
    <Box
      display="flex"
      justifyContent="space-between"
      alignItems="center"
      data-testid="protocol_fee"
      marginBottom="2"
    >
      <Box display="flex" alignItems="center" justifyContent="center" gap="1">
        <Text variant={{ weight: "normal", type: "muted" }}>
          {feesBps.label}
        </Text>

        <ToolTip label={feesBps.explanation}>
          <Box display="flex">
            <InfoIcon />
          </Box>
        </ToolTip>
      </Box>

      <ToolTip label={feesBps.inUSD}>
        <Text
          className={feeStyles}
          variant={{ weight: "normal", type: "muted" }}
        >
          {feesBps.inPercentage}
        </Text>
      </ToolTip>
    </Box>
  );
};
