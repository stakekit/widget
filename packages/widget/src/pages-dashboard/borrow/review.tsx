import { useAtom, useAtomSet, useAtomValue } from "@effect/atom-react";
import { Cause, Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useParams } from "react-router";
import { borrowActionFormAtom, borrowCreateActionAtom } from "../../borrow";
import { Box } from "../../components/atoms/box";
import { Divider } from "../../components/atoms/divider";
import { CaretLeftIcon } from "../../components/atoms/icons/caret-left";
import { Text } from "../../components/atoms/typography/text";
import { useTrackPage } from "../../hooks/tracking/use-track-page";
import { AnimationPage } from "../../navigation/containers/animation-page";
import { PageContainer } from "../../pages/components/page-container";
import { PageCtaButton } from "../../pages/components/page-cta";
import { formatNumber } from "../../utils";
import { DetailRow } from "../overview/earn-details/components/details-section";
import { getBorrowFlowRoutes } from "./flow-routes";
import { isBorrowReviewState } from "./review-state";
import * as styles from "./styles.css";

const formatPercentSummary = (value: string | undefined) => {
  const numericValue = Number(value);

  return Number.isFinite(numericValue)
    ? `${formatNumber(numericValue * 100, 2)}%`
    : null;
};

const formatUsdSummary = (value: string | undefined) => {
  const numericValue = Number(value);

  return Number.isFinite(numericValue)
    ? `$${formatNumber(numericValue, 2)}`
    : null;
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
  const location = useLocation();
  const navigate = useNavigate();
  const { marketId } = useParams();
  const routes = getBorrowFlowRoutes(marketId);
  const stageBorrowActionForm = useAtomSet(borrowActionFormAtom);
  const [createActionResult, createAction] = useAtom(borrowCreateActionAtom, {
    mode: "promise",
  });
  const actionFormState = useAtomValue(borrowActionFormAtom);
  const locationReviewState = isBorrowReviewState(location.state)
    ? location.state
    : null;
  const reviewState =
    locationReviewState ??
    (actionFormState.type === "review" ? actionFormState.reviewState : null);
  const [confirmAttempted, setConfirmAttempted] = useState(false);

  useEffect(() => {
    if (!reviewState) {
      return;
    }

    setConfirmAttempted(false);
  }, [reviewState]);

  if (!reviewState) {
    return (
      <AnimationPage>
        <PageContainer>
          <Box display="flex" flexDirection="column" gap="4">
            <Text variant={{ weight: "bold" }}>
              {t("dashboard.borrow.review_page.unavailable_title")}
            </Text>
            <Text variant={{ type: "muted", weight: "normal" }}>
              {t("dashboard.borrow.review_page.unavailable_description")}
            </Text>
            <PageCtaButton
              cta={{
                disabled: false,
                isLoading: false,
                label: t("dashboard.borrow.review_page.back"),
                onClick: () => navigate(routes.basePath),
              }}
            />
          </Box>
        </PageContainer>
      </AnimationPage>
    );
  }

  const { request, summary } = reviewState;
  const createActionErrorMessage = (() => {
    if (
      !confirmAttempted ||
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
  const onConfirm = () => {
    setConfirmAttempted(true);

    void createAction(request)
      .then((action) => {
        const executionState = { ...reviewState, action };

        stageBorrowActionForm({
          executionState,
          type: "prepareExecution",
        });
        navigate(routes.stepsPath, { state: executionState });
      })
      .catch(() => undefined);
  };
  const projectedLtv = formatTransition({
    current: null,
    projected: formatPercentSummary(summary.projectedLtv),
  });
  const projectedHealthFactor = summary.projectedHealthFactor
    ? formatNumber(Number(summary.projectedHealthFactor), 2)
    : null;
  const collateralValue = formatTransition({
    current: formatUsdSummary(summary.existingCollateralUsd),
    projected: formatUsdSummary(summary.projectedCollateralUsd),
  });
  const debtValue = formatTransition({
    current: formatUsdSummary(summary.existingDebtUsd),
    projected: formatUsdSummary(summary.projectedDebtUsd),
  });
  const actionRows = [
    {
      id: "action",
      label: t("dashboard.borrow.review_page.action"),
      value: t(`dashboard.borrow.review_page.actions.${summary.action}`),
    },
    summary.borrowAmount && summary.loanTokenSymbol
      ? {
          id: "borrow-amount",
          label: t("dashboard.borrow.review_page.borrow_amount"),
          value: `${summary.borrowAmount} ${summary.loanTokenSymbol}`,
        }
      : null,
    summary.collateralAmount && summary.collateralTokenSymbol
      ? {
          id: "collateral-amount",
          label: t("dashboard.borrow.review_page.collateral_amount"),
          value: `${summary.collateralAmount} ${summary.collateralTokenSymbol}`,
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
      value: summary.providerName,
    },
    {
      id: "network",
      label: t("dashboard.borrow.review_page.network"),
      value: summary.network,
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
      value: t("dashboard.borrow.review_page.estimated_fee_pending"),
    },
  ].filter((row): row is NonNullable<typeof row> => !!row);

  return (
    <AnimationPage>
      <PageContainer>
        <Box display="flex" flexDirection="column" gap="4">
          <Box display="flex" flexDirection="column" gap="2">
            <Box
              aria-label={
                marketId
                  ? t("dashboard.borrow.review_page.back_to_position")
                  : t("dashboard.borrow.review_page.back")
              }
              as="button"
              className={styles.flowBackButton}
              onClick={() => navigate(routes.basePath)}
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
              value={request.action}
            />
            <DetailRow
              id="market-id"
              label={t("dashboard.borrow.review_page.market_id")}
              value={request.args.marketId}
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
              onClick: onConfirm,
            }}
          />
        </Box>
      </PageContainer>
    </AnimationPage>
  );
};
