import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Option } from "effect";
import { useTranslation } from "react-i18next";
import { exactDecimal } from "../../../domain/finance/exact";
import { formatNumber } from "../../../shared/lib/number-format";
import {
  DetailRow,
  DetailRowList,
} from "../../../shared/ui/components/details-section";
import { Divider } from "../../../shared/ui/components/divider";
import { Box } from "../../../shared/ui/primitives/box";
import { CaretLeftIcon } from "../../../shared/ui/primitives/icons/caret-left";
import { Text } from "../../../shared/ui/primitives/typography/text";
import { useWidgetPresentation } from "../../../shared/ui/widget-presentation";
import { useTrackPage } from "../../tracking/index";
import {
  AnimationPage,
  PageContainer,
  PageCtaButton,
} from "../../widget-shell/views";
import { estimateBorrowPositionChange } from "../model/borrow-completion";
import {
  getBorrowReviewRiskBlock,
  projectBorrowTransactionFlowSummary,
} from "../model/borrow-transaction-flow";
import {
  useBorrowTransactionFlow,
  useBorrowTransactionFlowReview,
} from "../react/borrow-flow-route";
import { BorrowReviewConfirmationFailure } from "../state/borrow-review-confirmation-error";
import { BorrowFlowHeading } from "./flow-heading";
import { BorrowFlowPositionChangeRows } from "./position-change-rows";
import * as styles from "./styles.css";
import {
  BorrowFlowAmountRows,
  BorrowFlowOriginationRows,
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
      ? `${formatNumber(collateralFeeAmount, locale)} ${projectedSummary.collateral.symbol}`
      : null;
  const effectiveCollateral =
    hasCollateralFee &&
    projectedSummary.collateral &&
    "effectiveAmount" in projectedSummary.collateral
      ? `${formatNumber(projectedSummary.collateral.effectiveAmount, locale)} ${projectedSummary.collateral.symbol}`
      : null;

  return (
    <AnimationPage>
      <PageContainer>
        <Box display="flex" flexDirection="column" gap="4">
          <Box display="flex" flexDirection="column" gap="2">
            <Box
              aria-label={
                isPositionFlow
                  ? t("dashboard.borrow.review_page.back_to_position")
                  : t("dashboard.borrow.review_page.back")
              }
              as="button"
              className={styles.flowBackButton}
              onClick={() => back(undefined)}
              type="button"
            >
              <CaretLeftIcon />
            </Box>

            <BorrowFlowHeading summary={summary} />
          </Box>

          <Divider />

          <DetailRowList>
            <DetailRow
              id="market"
              label={t("dashboard.borrow.review_page.market")}
              value={summary.marketLabel}
            />
            <BorrowFlowAmountRows
              action={summary.action}
              projected={projectedSummary}
            />
            {effectiveCollateral ? (
              <DetailRow
                id="effective-collateral"
                label={t("dashboard.borrow.review_page.effective_collateral")}
                value={effectiveCollateral}
              />
            ) : null}
            <BorrowFlowPositionChangeRows
              change={estimateBorrowPositionChange(projectedSummary)}
            />
            {collateralFee ? (
              <DetailRow
                id="collateral-fee"
                label={t("dashboard.borrow.review_page.collateral_fee")}
                value={collateralFee}
              />
            ) : null}
            <BorrowFlowOriginationRows
              origination={projectedSummary.origination}
            />
          </DetailRowList>

          {Option.match(createActionErrorDescription, {
            onNone: () => null,
            onSome: (description) => (
              <Box className={styles.executionError}>
                <Text variant={{ type: "danger" }}>
                  {t(
                    `dashboard.borrow.execution_page.error_titles.${summary.action}`
                  )}
                </Text>
                <Text variant={{ type: "muted", weight: "normal" }}>
                  {description}
                </Text>
              </Box>
            ),
          })}

          {summary.warnings.map((warning) => (
            <Box className={styles.formCard} key={warning}>
              <Text variant={{ weight: "bold" }}>
                {t("dashboard.borrow.review_page.warning_title")}
              </Text>
              <Text variant={{ type: "muted", weight: "normal" }}>
                {t(`dashboard.borrow.review_page.warnings.${warning}`)}
              </Text>
            </Box>
          ))}

          {riskBlock ? (
            <Box className={styles.executionError}>
              <Text variant={{ type: "danger" }}>
                {t("dashboard.borrow.risk_block.title")}
              </Text>
              <Text variant={{ type: "muted", weight: "normal" }}>
                {t(`dashboard.borrow.risk_block.${riskBlock}`)}
              </Text>
            </Box>
          ) : null}

          <Text variant={{ type: "muted", weight: "normal" }}>
            {t(
              `dashboard.borrow.review_page.risk_disclosures.${summary.action}`
            )}
          </Text>

          <PageCtaButton
            cta={{
              disabled: confirmation.pending || riskBlock !== null,
              isLoading: confirmation.pending,
              label: t("dashboard.borrow.review_page.confirm"),
              onClick: () => confirm(undefined),
            }}
          />
        </Box>
      </PageContainer>
    </AnimationPage>
  );
};
