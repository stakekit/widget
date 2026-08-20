import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Cause, Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { useTranslation } from "react-i18next";
import { exactDecimal } from "../../../domain/finance/exact";
import {
  formatBorrowProviderName,
  formatHealthFactor,
  formatNetworkName,
  formatPercent,
  formatUsd,
} from "../../../shared/lib/formatters";
import { DetailRow } from "../../../shared/ui/components/details-section";
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
import {
  getBorrowTransactionFlowAmountLabelKey,
  projectBorrowTransactionFlowSummary,
} from "../model/borrow-transaction-flow";
import {
  useBorrowTransactionFlow,
  useBorrowTransactionFlowReview,
} from "../react/borrow-flow-route";
import * as styles from "./styles.css";

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
    ? `${current} -> ${projected}`
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

  const { command, summary } = reviewState;
  const projectedSummary = projectBorrowTransactionFlowSummary(summary);
  const createActionErrorMessage = (() => {
    if (
      !AsyncResult.isFailure(createActionResult) ||
      AsyncResult.isWaiting(createActionResult)
    ) {
      return null;
    }

    const error = Cause.findErrorOption(createActionResult.cause);

    if (
      Option.isSome(error) &&
      error.value &&
      typeof error.value === "object" &&
      "message" in error.value &&
      typeof error.value.message === "string"
    ) {
      return error.value.message;
    }

    return t("dashboard.borrow.error_description");
  })();
  const projectedLtv = formatTransition({
    current: null,
    projected: formatOptionalPercentSummary(
      projectedSummary.risk.projectedLtv ?? undefined
    ),
  });
  const projectedHealthFactor = projectedSummary.risk.projectedHealthFactor
    ? formatHealthFactor(projectedSummary.risk.projectedHealthFactor)
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
  const actionRows = [
    {
      id: "action",
      label: t("dashboard.borrow.review_page.action"),
      value: t(`dashboard.borrow.review_page.actions.${summary.action}`),
    },
    projectedSummary.borrow
      ? {
          id: "borrow-amount",
          label: t(getBorrowTransactionFlowAmountLabelKey(summary.action)),
          value: `${projectedSummary.borrow.amount} ${projectedSummary.borrow.symbol}`,
        }
      : null,
    projectedSummary.collateral
      ? {
          id: "collateral-amount",
          label: t("dashboard.borrow.review_page.collateral_amount"),
          value: `${projectedSummary.collateral.amount} ${projectedSummary.collateral.symbol}`,
        }
      : null,
    effectiveCollateral
      ? {
          id: "effective-collateral",
          label: t("dashboard.borrow.review_page.effective_collateral"),
          value: effectiveCollateral,
        }
      : null,
    {
      id: "market",
      label: t("dashboard.borrow.review_page.market"),
      value: summary.marketLabel,
    },
    {
      id: "provider",
      label: t("dashboard.borrow.review_page.provider"),
      value: formatBorrowProviderName(summary.providerName),
    },
    {
      id: "network",
      label: t("dashboard.borrow.review_page.network"),
      value: formatNetworkName(summary.network),
    },
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
    projectedLtv
      ? {
          id: "projected-ltv",
          label: t("dashboard.borrow.review_page.projected_ltv"),
          value: projectedLtv,
        }
      : null,
    projectedHealthFactor
      ? {
          id: "projected-health-factor",
          label: t("dashboard.borrow.review_page.projected_health_factor"),
          value: projectedHealthFactor,
        }
      : null,
    {
      id: "estimated-fee",
      label: t("dashboard.borrow.review_page.estimated_fee"),
      value:
        (hasCollateralFee ? collateralFee : null) ??
        t("dashboard.borrow.review_page.estimated_fee_pending"),
    },
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

            <Text variant={{ weight: "bold" }}>
              {t("dashboard.borrow.review_page.title")}
            </Text>
            <Text variant={{ type: "muted", weight: "normal" }}>
              {summary.marketLabel}
            </Text>
          </Box>

          <Divider />

          <Box display="flex" flexDirection="column" gap="1">
            {actionRows.map((row) => (
              <DetailRow key={row.id} {...row} />
            ))}
          </Box>

          <Box display="flex" flexDirection="column" gap="1">
            <DetailRow
              id="requested-action"
              label={t("dashboard.borrow.review_page.requested_action")}
              value={command.action}
            />
            <DetailRow
              id="market-id"
              label={t("dashboard.borrow.review_page.market_id")}
              value={command.args.marketId}
            />
          </Box>

          <Text variant={{ type: "muted", weight: "normal" }}>
            {t("dashboard.borrow.review_page.execution_pending")}
          </Text>

          {createActionErrorMessage ? (
            <Box className={styles.executionError}>
              <Text variant={{ type: "danger" }}>
                {t("dashboard.borrow.execution_page.error_title")}
              </Text>
              <Text variant={{ type: "muted", weight: "normal" }}>
                {createActionErrorMessage}
              </Text>
            </Box>
          ) : null}

          {summary.riskStatus === "unavailable" ? (
            <Box className={styles.formCard}>
              <Text variant={{ weight: "bold" }}>
                {t("dashboard.borrow.risk_unavailable.title")}
              </Text>
              <Text variant={{ type: "muted", weight: "normal" }}>
                {t("dashboard.borrow.risk_unavailable.description")}
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
