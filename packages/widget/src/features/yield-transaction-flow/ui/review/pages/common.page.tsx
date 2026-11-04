import type { ComponentProps } from "react";
import { Trans, useTranslation } from "react-i18next";
import type { EarnYieldWithProvider } from "../../../../../domain/earn/models";
import type { Token } from "../../../../../domain/token/token";
import { ExternalLink, Notice, Stack, Text } from "../../../../../ui/index";
import { useTrackEvent } from "../../../../tracking/index";
import { useWidgetConfig } from "../../../../widget-configuration/index";
import {
  AnimationPage,
  PageContainer,
  type PageCta,
  PageCtaButton,
} from "../../../../widget-shell/views";
import { KycGateCard, MetaInfo } from "../../../../yield-summary/views";
import type { FeesBps } from "../types";
import { type ReviewFact, ReviewOverview } from "./review-overview";

export type MetaInfoProps =
  | { showMetaInfo: true; metaInfoProps: ComponentProps<typeof MetaInfo> }
  | { showMetaInfo: false; metaInfoProps?: never };

type ReviewPageProps = {
  readonly title: string;
  /** The formatted amount with its symbol, such as "1.5 ETH". */
  readonly amount: string;
  /** What follows the amount, such as the reward rate it earns. */
  readonly destination?: string | undefined;
  readonly facts?: ReadonlyArray<ReviewFact> | undefined;
  /** Null when no gas estimate settled. */
  readonly fee: string | null;
  readonly token: Token | null;
  readonly metadata: ComponentProps<typeof ReviewOverview>["metadata"];
  readonly isGasCheckError: boolean;
  readonly loading?: boolean;
  readonly depositFee: FeesBps | null;
  readonly managementFee: FeesBps | null;
  readonly performanceFee: FeesBps | null;
  readonly commissionFee: string | null;
  readonly kyc?: ComponentProps<typeof KycGateCard>;
  readonly feeConfigLoading?: boolean;
  readonly cta: PageCta;
} & MetaInfoProps;

type PositionActionReview = {
  readonly amount: string;
  readonly cta: PageCta;
  readonly facts: ReadonlyArray<ReviewFact>;
  readonly fee: string | null;
  readonly gasCheckLoading: boolean;
  readonly integrationData: EarnYieldWithProvider;
  readonly isGasCheckWarning: boolean;
  readonly title: string;
  readonly token: Token;
};

/** Review props for acting on a held position, where no entry fees apply. */
export const getPositionActionReviewProps = (review: PositionActionReview) => ({
  amount: `${review.amount} ${review.token.symbol}`,
  commissionFee: null,
  cta: review.cta,
  depositFee: null,
  facts: review.facts,
  fee: review.fee,
  feeConfigLoading: false,
  isGasCheckError: review.isGasCheckWarning,
  loading: review.gasCheckLoading,
  managementFee: null,
  metadata: {
    logoURI: review.integrationData.metadata.logoURI,
    name: review.integrationData.metadata.name,
    provider: review.integrationData.provider,
  },
  performanceFee: null,
  title: review.title,
  token: review.token,
});

export const ReviewPage = ({
  title,
  amount,
  destination,
  facts,
  fee,
  token,
  metadata,
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

  const gasFeeRow = isLoading
    ? {
        label: t("review.estimated_gas_fee"),
        loading: true as const,
        testId: "estimated_gas_fee",
      }
    : {
        label: t("review.estimated_gas_fee"),
        testId: "estimated_gas_fee",
        value: fee ?? t("review.gas_fee_unavailable"),
      };

  const feeRows = [
    ...(hideGasFee ? [] : [gasFeeRow]),
    ...(commissionFee
      ? [
          {
            label: t("review.staking_fee"),
            testId: "commission_fee",
            value: commissionFee,
          },
        ]
      : []),
    ...configFees.map((configFee) => ({
      info: {
        label: t("review.fee_info", { fee: configFee.label }),
        // The fee's token amount, once known, follows its explanation.
        text: configFee.inUSD
          ? `${configFee.explanation} (${configFee.inUSD.trim()})`
          : configFee.explanation,
      },
      label: configFee.label,
      testId: "protocol_fee",
      value: configFee.inPercentage,
    })),
  ];

  return (
    <AnimationPage>
      <PageContainer>
        <Stack gap={24}>
          <ReviewOverview
            title={title}
            amount={amount}
            destination={destination}
            facts={facts}
            metadata={metadata}
            token={token}
            {...(showFees
              ? {
                  fees: {
                    heading: t("shared.fees"),
                    loading: hideGasFee && isLoading,
                    rows: feeRows,
                  },
                }
              : {})}
          />

          {kyc && (kyc.gate.state !== "pass" || kyc.isChecking) && (
            <KycGateCard {...kyc} />
          )}

          {isGasCheckError && (
            <Notice tone="warning">{t("review.gas_warning")}</Notice>
          )}

          {rest.showMetaInfo && (
            <Stack gap={12}>
              <Text variant="heading" as="h2">
                {t("review.additional_info")}
              </Text>

              <MetaInfo {...rest.metaInfoProps} />
            </Stack>
          )}

          <Text as="p" variant="caption" tone="muted">
            <Trans
              i18nKey="review.terms_of_use"
              components={{
                underline0: (
                  <ExternalLink
                    href="https://docs.yield.xyz/docs/terms-of-use"
                    newTabLabel={t("shared.opens_in_new_tab")}
                    onClick={() => trackEvent("termsClicked")}
                  >
                    {null}
                  </ExternalLink>
                ),
              }}
            />
          </Text>
        </Stack>

        <PageCtaButton cta={cta} />
      </PageContainer>
    </AnimationPage>
  );
};
