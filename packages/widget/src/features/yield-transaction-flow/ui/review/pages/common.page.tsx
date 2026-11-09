import type { ComponentProps } from "react";
import { useTranslation } from "react-i18next";
import type { Token } from "../../../../../domain/token/token";
import { Notice, Stack, Text } from "../../../../../ui/index";
import { TransactionTerms } from "../../../../transaction-steps/views";
import { useWidgetConfig } from "../../../../widget-configuration/index";
import {
  AnimationPage,
  PageContainer,
  type PageCta,
  PageCtaButton,
} from "../../../../widget-shell/views";
import { KycGateCard, MetaInfo } from "../../../../yield-summary/views";
import type { YieldFlowAttribution } from "../../../model/attribution";
import type { FeesBps } from "../types";
import { type ReviewFact, ReviewOverview } from "./review-overview";

/** Says the network fee takes much of what the action is worth. */
type FeeWarning = Readonly<{
  readonly message: string;
  readonly title: string;
}>;

export type MetaInfoProps =
  | { showMetaInfo: true; metaInfoProps: ComponentProps<typeof MetaInfo> }
  | { showMetaInfo: false; metaInfoProps?: never };

type ReviewPageProps = {
  readonly title: string;
  /** The formatted amount with its symbol, such as "1.5 ETH". */
  readonly amount: string;
  /** The amount's fiat value, such as "$2.42"; null when its price is unknown. */
  readonly amountFiat?: string | null;
  /** Where the amount goes, such as the yield and its provider. */
  readonly destination?: string | undefined;
  /** Who runs the action: its logo leads the destination. */
  readonly attribution?: YieldFlowAttribution | null;
  /** Shown once fees settle, when the network fee eats much of the value. */
  readonly feeWarning?: FeeWarning | null;
  readonly facts?: ReadonlyArray<ReviewFact> | undefined;
  /** Null when no gas estimate settled. */
  readonly fee: string | null;
  readonly token: Token | null;
  readonly isGasCheckError: boolean;
  readonly loading?: boolean;
  readonly depositFee: FeesBps | null;
  /** The exit's withdrawal fee; null on other reviews or without one. */
  readonly withdrawalFee?: FeesBps | null;
  readonly managementFee: FeesBps | null;
  readonly performanceFee: FeesBps | null;
  readonly commissionFee: string | null;
  readonly kyc?: ComponentProps<typeof KycGateCard>;
  readonly feeConfigLoading?: boolean;
  readonly cta: PageCta;
} & MetaInfoProps;

type PositionActionReview = {
  readonly amount: string;
  readonly amountFiat: string | null;
  readonly attribution: YieldFlowAttribution | null;
  readonly cta: PageCta;
  readonly destination: string;
  readonly facts: ReadonlyArray<ReviewFact>;
  readonly fee: string | null;
  readonly feeWarning: FeeWarning | null;
  readonly gasCheckLoading: boolean;
  readonly isGasCheckWarning: boolean;
  readonly title: string;
  readonly token: Token;
};

/**
 * Review props for acting on a held position, where no entry fees apply; an
 * exit passes its withdrawal fee beside them.
 */
export const getPositionActionReviewProps = (review: PositionActionReview) => ({
  amount: `${review.amount} ${review.token.symbol}`,
  amountFiat: review.amountFiat,
  attribution: review.attribution,
  commissionFee: null,
  cta: review.cta,
  depositFee: null,
  destination: review.destination,
  facts: review.facts,
  fee: review.fee,
  feeWarning: review.feeWarning,
  feeConfigLoading: false,
  isGasCheckError: review.isGasCheckWarning,
  loading: review.gasCheckLoading,
  managementFee: null,
  performanceFee: null,
  title: review.title,
  token: review.token,
});

export const ReviewPage = ({
  title,
  amount,
  amountFiat,
  destination,
  attribution = null,
  feeWarning = null,
  facts,
  fee,
  token,
  isGasCheckError,
  loading = false,
  depositFee,
  withdrawalFee = null,
  managementFee,
  performanceFee,
  feeConfigLoading = false,
  commissionFee,
  kyc,
  cta,
  ...rest
}: ReviewPageProps) => {
  const { t } = useTranslation();
  const hideGasFee = useWidgetConfig("hideGasFee");

  const isLoading = loading || feeConfigLoading;
  const configFees = isLoading
    ? []
    : [depositFee, withdrawalFee, managementFee, performanceFee].filter(
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

  // The gas check expects the action to fail: the user may still go ahead,
  // but only on purpose, with the warning beside the button.
  const gasWarned = isGasCheckError && cta !== null;
  const confirmCta: PageCta =
    gasWarned && cta
      ? { ...cta, label: t("review.confirm_anyway"), variant: "secondary" }
      : cta;

  return (
    <AnimationPage>
      <PageContainer>
        <Stack gap={24}>
          <ReviewOverview
            title={title}
            amount={amount}
            amountFiat={amountFiat}
            destination={destination}
            attribution={attribution}
            facts={facts}
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

          {/* A hidden gas estimate is the host's to explain. */}
          {feeWarning && !isLoading && !hideGasFee && (
            <Notice tone="warning" title={feeWarning.title}>
              {feeWarning.message}
            </Notice>
          )}

          {kyc && (kyc.gate.state !== "pass" || kyc.isChecking) && (
            <KycGateCard {...kyc} />
          )}

          {isGasCheckError && !gasWarned && (
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

          <TransactionTerms action={confirmCta?.label ?? t("shared.confirm")} />
        </Stack>

        <PageCtaButton
          cta={confirmCta}
          {...(gasWarned
            ? {
                notice: (
                  <Notice tone="warning">{t("review.gas_warning")}</Notice>
                ),
              }
            : {})}
        />
      </PageContainer>
    </AnimationPage>
  );
};
