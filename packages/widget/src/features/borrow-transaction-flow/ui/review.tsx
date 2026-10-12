import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Cause, Option } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { useTranslation } from "react-i18next";
import { exactDecimal } from "../../../domain/finance/exact";
import {
  formatHealthFactor,
  formatPercent,
  formatUsd,
} from "../../../shared/lib/formatters";
import {
  DetailRow,
  DetailRowList,
} from "../../../shared/ui/components/details-section";
import { Divider } from "../../../shared/ui/components/divider";
import { Box } from "../../../shared/ui/primitives/box";
import { CaretLeftIcon } from "../../../shared/ui/primitives/icons/caret-left";
import { Text } from "../../../shared/ui/primitives/typography/text";
import { useTrackPage } from "../../tracking/index";
import {
  AnimationPage,
  PageContainer,
  PageCtaButton,
} from "../../widget-shell/views";
import { projectBorrowTransactionFlowSummary } from "../model/borrow-transaction-flow";
import {
  useBorrowTransactionFlow,
  useBorrowTransactionFlowReview,
} from "../react/borrow-flow-route";
import {
  borrowReviewConfirmationErrorCopy,
  presentBorrowReviewConfirmationError,
} from "./borrow-review-confirmation-error";
import { BorrowFlowHeading } from "./flow-heading";
import * as styles from "./styles.css";
import {
  BorrowFlowAmountRows,
  BorrowFlowOriginationRows,
} from "./summary-rows";

const formatOptionalSummary = (value: string | undefined) => {
  if (!value) return null;

  const formatted = formatUsd(value);

  return formatted === "-" ? null : formatted;
};

const formatOptionalPercentSummary = (value: string | undefined) => {
  if (!value) return null;

  const formatted = formatPercent(value);

  return formatted === "-" ? null : formatted;
};

const formatTransition = ({
  current,
  projected,
}: {
  readonly current: string | null;
  readonly projected: string | null;
}) => {
  if (!projected) {
    return null;
  }

  return current && current !== projected
    ? `${current} → ${projected}`
    : projected;
};

export const BorrowReviewPage = () => {
  useTrackPage("borrowReview");

  const { t } = useTranslation();
  const flow = useBorrowTransactionFlow();
  const review = useBorrowTransactionFlowReview();
  const createActionResult = useAtomValue(review.confirmAtom);
  const confirm = useAtomSet(review.confirmAtom);
  const back = useAtomSet(review.backAtom);
  const reviewState = flow.intake;
  const isPositionFlow = flow.intake.entry._tag === "MarketPosition";

  const { summary } = reviewState;
  const projectedSummary = projectBorrowTransactionFlowSummary(summary);
  const createActionErrorCopy = (() => {
    if (
      !AsyncResult.isFailure(createActionResult) ||
      AsyncResult.isWaiting(createActionResult)
    ) {
      return null;
    }

    const error = Cause.findErrorOption(createActionResult.cause);

    return Option.match(error, {
      onNone: () => borrowReviewConfirmationErrorCopy,
      onSome: presentBorrowReviewConfirmationError,
    });
  })();
  const { risk } = projectedSummary;
  const ltv = formatTransition({
    current: formatOptionalPercentSummary(risk.currentLtv ?? undefined),
    projected: formatOptionalPercentSummary(risk.projectedLtv ?? undefined),
  });
  const healthFactor = risk.projectedHealthFactor
    ? formatTransition({
        current: risk.currentHealthFactor
          ? formatHealthFactor(risk.currentHealthFactor)
          : null,
        projected: formatHealthFactor(risk.projectedHealthFactor),
      })
    : null;
  const collateralValue = formatTransition({
    current: formatOptionalSummary(
      projectedSummary.financials.existingCollateralUsd ?? undefined
    ),
    projected: formatOptionalSummary(
      projectedSummary.financials.projectedCollateralUsd ?? undefined
    ),
  });
  const debtValue = formatTransition({
    current: formatOptionalSummary(
      projectedSummary.financials.existingDebtUsd ?? undefined
    ),
    projected: formatOptionalSummary(
      projectedSummary.financials.projectedDebtUsd ?? undefined
    ),
  });
  const collateralFeeAmount =
    projectedSummary.collateral && "feeAmount" in projectedSummary.collateral
      ? projectedSummary.collateral.feeAmount
      : undefined;
  const hasCollateralFee =
    collateralFeeAmount !== undefined &&
    exactDecimal(collateralFeeAmount).isGreaterThan(0);
  const collateralFee =
    hasCollateralFee && projectedSummary.collateral
      ? `${collateralFeeAmount} ${projectedSummary.collateral.symbol}`
      : null;
  const effectiveCollateral =
    hasCollateralFee &&
    projectedSummary.collateral &&
    "effectiveAmount" in projectedSummary.collateral
      ? `${projectedSummary.collateral.effectiveAmount} ${projectedSummary.collateral.symbol}`
      : null;
  const financialRows = [
    collateralValue
      ? {
          id: "collateral-value",
          label: t("dashboard.borrow.form.collateral_value"),
          value: collateralValue,
        }
      : null,
    debtValue
      ? {
          id: "debt-value",
          label: t("dashboard.borrow.position_details.debt"),
          value: debtValue,
        }
      : null,
    ltv
      ? {
          id: "ltv",
          label: t("dashboard.borrow.review_page.ltv"),
          value: ltv,
        }
      : null,
    healthFactor
      ? {
          id: "health-factor",
          label: t("dashboard.borrow.review_page.health_factor"),
          value: healthFactor,
        }
      : null,
    collateralFee
      ? {
          id: "collateral-fee",
          label: t("dashboard.borrow.review_page.collateral_fee"),
          value: collateralFee,
        }
      : null,
  ].filter((row): row is NonNullable<typeof row> => !!row);

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
            {financialRows.map((row) => (
              <DetailRow key={row.id} {...row} />
            ))}
            <BorrowFlowOriginationRows
              origination={projectedSummary.origination}
            />
          </DetailRowList>

          {createActionErrorCopy ? (
            <Box className={styles.executionError}>
              <Text variant={{ type: "danger" }}>
                {t(createActionErrorCopy.titleKey)}
              </Text>
              <Text variant={{ type: "muted", weight: "normal" }}>
                {t(createActionErrorCopy.descriptionKey)}
              </Text>
            </Box>
          ) : null}

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

          <Text variant={{ type: "muted", weight: "normal" }}>
            {t(
              `dashboard.borrow.review_page.risk_disclosures.${summary.action}`
            )}
          </Text>

          <PageCtaButton
            cta={{
              disabled: createActionResult.waiting,
              isLoading: createActionResult.waiting,
              label: t("dashboard.borrow.review_page.confirm"),
              onClick: () => confirm(undefined),
            }}
          />
        </Box>
      </PageContainer>
    </AnimationPage>
  );
};
