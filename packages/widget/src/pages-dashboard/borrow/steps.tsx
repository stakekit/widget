import { useAtomValue } from "@effect/atom-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useParams } from "react-router";
import {
  type BorrowExecutionStepStatus,
  borrowActionFormAtom,
} from "../../borrow";
import { Box } from "../../components/atoms/box";
import { Button } from "../../components/atoms/button";
import { CaretLeftIcon } from "../../components/atoms/icons/caret-left";
import { CheckCircleIcon } from "../../components/atoms/icons/check-circle";
import { XIcon } from "../../components/atoms/icons/x-icon";
import { Spinner } from "../../components/atoms/spinner";
import { Text } from "../../components/atoms/typography/text";
import { useTrackPage } from "../../hooks/tracking/use-track-page";
import { AnimationPage } from "../../navigation/containers/animation-page";
import { PageContainer } from "../../pages/components/page-container";
import { PageCtaButton } from "../../pages/components/page-cta";
import { useSettings } from "../../providers/settings";
import { getBorrowFlowRoutes } from "./flow-routes";
import { type BorrowStepsState, isBorrowStepsState } from "./review-state";
import * as styles from "./styles.css";
import { useBorrowExecution } from "./use-borrow-execution";

const StepIcon = ({
  status,
}: {
  readonly status: BorrowExecutionStepStatus;
}) =>
  status === "active" ? (
    <Spinner />
  ) : status === "completed" ? (
    <CheckCircleIcon height={20} width={20} />
  ) : status === "failed" ? (
    <XIcon color="textDanger" />
  ) : (
    <Box
      borderColor="textMuted"
      borderRadius="half"
      borderStyle="solid"
      borderWidth={1}
      hw="5"
    />
  );

export const BorrowStepsPage = () => {
  useTrackPage("borrowSteps");

  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { marketId } = useParams();
  const { basePath } = getBorrowFlowRoutes(marketId);
  const actionFormState = useAtomValue(borrowActionFormAtom);
  const locationExecutionState = isBorrowStepsState(location.state)
    ? location.state
    : null;
  const executionState =
    locationExecutionState ??
    (actionFormState.type === "execution"
      ? actionFormState.executionState
      : null);

  if (!executionState) {
    return (
      <AnimationPage>
        <PageContainer>
          <Box display="flex" flexDirection="column" gap="4">
            <Text variant={{ weight: "bold" }}>
              {t("dashboard.borrow.execution_page.unavailable_title")}
            </Text>
            <Text variant={{ type: "muted", weight: "normal" }}>
              {t("dashboard.borrow.execution_page.unavailable_description")}
            </Text>
            <PageCtaButton
              cta={{
                disabled: false,
                isLoading: false,
                label: t("dashboard.borrow.review_page.back"),
                onClick: () => navigate(basePath),
              }}
            />
          </Box>
        </PageContainer>
      </AnimationPage>
    );
  }

  return <BorrowStepsContent executionState={executionState} />;
};

const BorrowStepsContent = ({
  executionState,
}: {
  readonly executionState: BorrowStepsState;
}) => {
  const { dashboardVariant } = useSettings();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { marketId } = useParams();
  const { basePath, completePath } = getBorrowFlowRoutes(marketId);
  const execution = useBorrowExecution({ action: executionState.action });
  const totalTransactions = execution.action?.transactions.length ?? 0;
  const transactionPosition =
    execution.currentTransactionIndex == null
      ? null
      : execution.currentTransactionIndex + 1;

  useEffect(() => {
    if (!execution.completionResult) {
      return;
    }

    navigate(completePath, {
      replace: true,
      state: { ...executionState, result: execution.completionResult },
    });
  }, [completePath, execution.completionResult, executionState, navigate]);

  return (
    <AnimationPage>
      <PageContainer>
        <Box
          data-rk="borrow-steps-page"
          display="flex"
          flexDirection="column"
          gap="4"
        >
          <Box display="flex" flexDirection="column" gap="2">
            {marketId ? (
              <Box
                aria-label={t("dashboard.borrow.review_page.back_to_position")}
                as="button"
                className={styles.flowBackButton}
                onClick={() => navigate(basePath)}
                type="button"
              >
                <CaretLeftIcon />
              </Box>
            ) : null}

            <Text variant={{ weight: "bold" }}>
              {t("dashboard.borrow.execution_page.title")}
            </Text>
            <Text variant={{ type: "muted", weight: "normal" }}>
              {executionState.summary.marketLabel}
            </Text>
          </Box>

          <Box
            background="backgroundMuted"
            borderRadius="xl"
            display="flex"
            flexDirection="column"
            gap="3"
            px="4"
            py="4"
          >
            {execution.steps.map((step) => (
              <Box
                key={step.id}
                alignItems="center"
                className={styles.executionStep}
                display="flex"
                gap="3"
              >
                <Box
                  alignItems="center"
                  display="flex"
                  hw="8"
                  justifyContent="center"
                >
                  <StepIcon status={step.status} />
                </Box>
                <Box display="flex" flexDirection="column" gap="1">
                  <Text>
                    {t(
                      `dashboard.borrow.execution_page.steps.${step.id}.label`
                    )}
                  </Text>
                  <Text variant={{ type: "muted", weight: "normal" }}>
                    {t(
                      `dashboard.borrow.execution_page.steps.${step.id}.description`
                    )}
                  </Text>
                </Box>
              </Box>
            ))}
          </Box>

          {execution.error && (
            <Box className={styles.executionError}>
              <Text variant={{ type: "danger" }}>
                {t("dashboard.borrow.execution_page.error_title")}
              </Text>
              <Text variant={{ type: "muted", weight: "normal" }}>
                {execution.error.message}
              </Text>
            </Box>
          )}

          {(execution.currentTransaction ||
            execution.submissions.length > 0) && (
            <Box className={styles.formCard}>
              {execution.currentTransaction && transactionPosition ? (
                <>
                  <Text variant={{ weight: "bold" }}>
                    {t("dashboard.borrow.execution_page.current_transaction", {
                      current: transactionPosition,
                      total: totalTransactions,
                    })}
                  </Text>
                  <Text variant={{ type: "muted", weight: "normal" }}>
                    {execution.currentTransaction.type}
                    {" · "}
                    {execution.currentTransaction.status}
                  </Text>
                </>
              ) : null}

              {execution.submissions.map((submission) =>
                submission.link ? (
                  <Box
                    as="button"
                    background="transparent"
                    data-rk="borrow-steps-transaction-link"
                    key={submission.transaction.id}
                    onClick={() => window.open(submission.link, "_blank")}
                    style={{ border: 0 }}
                    type="button"
                  >
                    <Text variant={{ type: "muted" }}>
                      {t("dashboard.borrow.success_page.view_transaction")}
                    </Text>
                  </Box>
                ) : null
              )}
            </Box>
          )}

          {execution.error && (
            <Button
              data-rk="borrow-steps-retry"
              onClick={execution.retry}
              variant={{ size: dashboardVariant ? "compact" : "regular" }}
            >
              {t("shared.retry")}
            </Button>
          )}

          <PageCtaButton
            cta={{
              disabled: execution.isRunning,
              isLoading: false,
              label: t("shared.cancel"),
              onClick: () => navigate(basePath),
              variant: "secondary",
            }}
          />
        </Box>
      </PageContainer>
    </AnimationPage>
  );
};
