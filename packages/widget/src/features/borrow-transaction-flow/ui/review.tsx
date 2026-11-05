import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Option } from "effect";
import { useTranslation } from "react-i18next";
import { exactDecimal } from "../../../domain/finance/exact";
import {
  formatBorrowProviderName,
  formatNetworkName,
} from "../../../shared/lib/formatters";
import {
  formatTokenAmount,
  formatUsd,
} from "../../../shared/lib/number-format";
import { useWidgetPresentation } from "../../../shared/react/widget-presentation";
import {
  IconButton,
  Notice,
  ReviewSummary,
  Stack,
  Text,
} from "../../../ui/index";
import { useTrackPage } from "../../tracking/index";
import {
  AnimationPage,
  PageContainer,
  PageCtaButton,
} from "../../widget-shell/views";
import {
  estimateBorrowPositionChange,
  getBorrowFlowHeadline,
} from "../model/borrow-completion";
import {
  getBorrowReviewRiskBlock,
  getBorrowTransactionFlowTitle,
  projectBorrowTransactionFlowSummary,
} from "../model/borrow-transaction-flow";
import {
  useBorrowTransactionFlow,
  useBorrowTransactionFlowReview,
} from "../react/borrow-flow-route";
import { BorrowReviewConfirmationFailure } from "../state/review-page";
import {
  getBorrowFlowCollateralAmountRow,
  getBorrowFlowOriginationRows,
  getBorrowFlowPositionChangeRows,
} from "./summary-rows";

export const BorrowReviewPage = () => {
  useTrackPage("borrowReview");

  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();
  const flow = useBorrowTransactionFlow();
  const review = useBorrowTransactionFlowReview();
  const confirmation = useAtomValue(review.confirmAtom);
  const confirm = useAtomSet(review.confirmAtom);
  const back = useAtomSet(review.backAtom);
  const reviewState = flow.intake;
  const isPositionFlow = flow.intake.entry._tag === "MarketPosition";

  const { summary } = reviewState;
  const projectedSummary = projectBorrowTransactionFlowSummary(summary);
  const riskBlock = getBorrowReviewRiskBlock(reviewState);
  const title = getBorrowTransactionFlowTitle(summary);
  const headline = getBorrowFlowHeadline(summary, projectedSummary);
  const createActionErrorDescription = Option.map(
    confirmation.failure,
    BorrowReviewConfirmationFailure.match({
      Failed: () =>
        t("dashboard.borrow.review_page.confirmation_error_description"),
      Rejected: ({ reason }) => reason,
    })
  );
  const collateralFeeAmount =
    projectedSummary.collateral && "feeAmount" in projectedSummary.collateral
      ? projectedSummary.collateral.feeAmount
      : undefined;
  const hasCollateralFee =
    collateralFeeAmount !== undefined &&
    exactDecimal(collateralFeeAmount).isGreaterThan(0);
  const collateralFee =
    hasCollateralFee && projectedSummary.collateral
      ? `${formatTokenAmount(collateralFeeAmount, locale, "up")} ${projectedSummary.collateral.symbol}`
      : null;
  const effectiveCollateral =
    hasCollateralFee &&
    projectedSummary.collateral &&
    "effectiveAmount" in projectedSummary.collateral
      ? `${formatTokenAmount(projectedSummary.collateral.effectiveAmount, locale, "down")} ${projectedSummary.collateral.symbol}`
      : null;

  const origination = getBorrowFlowOriginationRows({
    locale,
    origination: projectedSummary.origination,
    t,
  });
  // The headline shows the amount the action is about; the rows show the
  // rest of what it moves and the position it leaves.
  const facts = [
    {
      label: t("dashboard.borrow.review_page.market"),
      value: summary.marketLabel,
    },
    // A borrow's headline is the loan, so the collateral it supplies is a row.
    ...(projectedSummary.borrow && projectedSummary.collateral
      ? [
          getBorrowFlowCollateralAmountRow({
            collateral: projectedSummary.collateral,
            locale,
            t,
          }),
        ]
      : []),
    ...(effectiveCollateral
      ? [
          {
            label: t("dashboard.borrow.review_page.effective_collateral"),
            value: effectiveCollateral,
          },
        ]
      : []),
    ...getBorrowFlowPositionChangeRows({
      change: estimateBorrowPositionChange(projectedSummary),
      locale,
      t,
    }),
    ...(origination ? [origination.principal] : []),
  ];
  const feeRows = [
    ...(collateralFee
      ? [
          {
            label: t("dashboard.borrow.review_page.collateral_fee"),
            value: collateralFee,
          },
        ]
      : []),
    ...(origination ? [origination.fee] : []),
  ];

  return (
    <AnimationPage>
      <PageContainer>
        <Stack gap={16}>
          <IconButton
            icon="CaretLeftIcon"
            label={
              isPositionFlow
                ? t("dashboard.borrow.review_page.back_to_position")
                : t("dashboard.borrow.review_page.back")
            }
            size="sm"
            onClick={() => back(undefined)}
          />

          <ReviewSummary
            title={t(title.key, { symbol: title.symbol })}
            amount={
              headline.amount === null
                ? headline.symbol
                : `${formatTokenAmount(headline.amount, locale, "down")} ${headline.symbol}`
            }
            {...(headline.usd
              ? { amountFiat: formatUsd(headline.usd, locale) }
              : {})}
            destination={`${formatBorrowProviderName(summary.providerName)} · ${formatNetworkName(summary.network)}`}
            facts={facts}
            {...(feeRows.length > 0
              ? { fees: { heading: t("shared.fees"), rows: feeRows } }
              : {})}
          />

          {Option.match(createActionErrorDescription, {
            onNone: () => null,
            onSome: (description) => (
              <Notice
                tone="danger"
                title={t(
                  `dashboard.borrow.execution_page.error_titles.${summary.action}`
                )}
              >
                {description}
              </Notice>
            ),
          })}

          {summary.warnings.map((warning) => (
            <Notice
              key={warning}
              tone="warning"
              title={t("dashboard.borrow.review_page.warning_title")}
            >
              {t(`dashboard.borrow.review_page.warnings.${warning}`)}
            </Notice>
          ))}

          {riskBlock ? (
            <Notice
              tone="danger"
              title={t("dashboard.borrow.risk_block.title")}
            >
              {t(`dashboard.borrow.risk_block.${riskBlock}`)}
            </Notice>
          ) : null}

          <Text as="p" variant="caption" tone="muted">
            {t(
              `dashboard.borrow.review_page.risk_disclosures.${summary.action}`
            )}
          </Text>
        </Stack>

        <PageCtaButton
          cta={{
            disabled: confirmation.pending || riskBlock !== null,
            isLoading: confirmation.pending,
            label: t("dashboard.borrow.review_page.confirm"),
            onClick: () => confirm(undefined),
          }}
        />
      </PageContainer>
    </AnimationPage>
  );
};
