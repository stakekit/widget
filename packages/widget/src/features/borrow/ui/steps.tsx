import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router";
import { useWidgetConfig } from "../../../app/config/use-widget-config";
import { Box } from "../../../shared/ui/primitives/box";
import { Button } from "../../../shared/ui/primitives/button";
import { CaretLeftIcon } from "../../../shared/ui/primitives/icons/caret-left";
import { Spinner } from "../../../shared/ui/primitives/spinner";
import { Text } from "../../../shared/ui/primitives/typography/text";
import { useTrackPage } from "../../tracking/react/use-track-page";
import { AnimationPage } from "../../widget-shell/animation-page";
import { PageContainer } from "../../widget-shell/page-container";
import { PageCtaButton } from "../../widget-shell/page-cta";
import { getBorrowFlowRoutes } from "./flow-routes";
import * as styles from "./styles.css";
import { useBorrowExecution } from "./use-borrow-execution";

export const BorrowStepsPage = () => {
  useTrackPage("borrowSteps");

  const dashboardVariant = useWidgetConfig("dashboardVariant");
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { marketId } = useParams();
  const { basePath, completePath } = getBorrowFlowRoutes(marketId);
  const execution = useBorrowExecution();
  const executionState = execution.input;
  const transactionPosition =
    execution.currentTransactionIndex == null
      ? null
      : execution.currentTransactionIndex + 1;

  useEffect(() => {
    if (!execution.completionResult) {
      return;
    }

    navigate(completePath, { replace: true });
  }, [completePath, execution.completionResult, navigate]);

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
            <Text variant={{ weight: "bold" }}>
              {t("dashboard.borrow.execution_page.action_progress", {
                current: execution.currentStep,
                total: execution.totalSteps,
              })}
            </Text>
            <Box alignItems="center" display="flex" gap="3">
              {execution.isRunning ? <Spinner /> : null}
              <Text variant={{ type: "muted", weight: "normal" }}>
                {t(`dashboard.borrow.execution_page.status.${execution.phase}`)}
              </Text>
            </Box>
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
                      total: execution.currentBatchTransactionCount,
                    })}
                  </Text>
                  <Text variant={{ type: "muted", weight: "normal" }}>
                    {execution.currentTransaction.type}
                    {" · "}
                    {execution.currentTransaction.status}
                  </Text>
                </>
              ) : null}
            </Box>
          )}

          {execution.batches.length > 0 ? (
            <Box
              className={styles.formCard}
              display="flex"
              flexDirection="column"
              gap="3"
            >
              <Text variant={{ weight: "bold" }}>
                {t("dashboard.borrow.execution_page.history_title")}
              </Text>
              {execution.batches.map((batch) => (
                <Box
                  data-rk="borrow-steps-batch"
                  display="flex"
                  flexDirection="column"
                  gap="2"
                  key={batch.id}
                >
                  <Text variant={{ type: "muted", weight: "normal" }}>
                    {t("dashboard.borrow.execution_page.batch_progress", {
                      current: batch.currentStep,
                      total: batch.totalSteps,
                    })}
                  </Text>
                  {batch.transactions.map((transaction) => {
                    const submission =
                      transaction.meta.submissionIndex === null
                        ? null
                        : execution.submissions[
                            transaction.meta.submissionIndex
                          ];

                    return (
                      <Box
                        alignItems="center"
                        display="flex"
                        justifyContent="space-between"
                        key={transaction.source.transaction.id}
                      >
                        <Text variant={{ type: "muted", weight: "normal" }}>
                          {transaction.source.transaction.type}
                          {" · "}
                          {transaction.meta.done
                            ? t(
                                "dashboard.borrow.execution_page.transaction_complete"
                              )
                            : transaction.source.transaction.status}
                        </Text>
                        {submission?.link ? (
                          <Box
                            as="button"
                            background="transparent"
                            data-rk="borrow-steps-transaction-link"
                            onClick={() =>
                              window.open(submission.link ?? "", "_blank")
                            }
                            style={{ border: 0 }}
                            type="button"
                          >
                            <Text variant={{ type: "muted" }}>
                              {t(
                                "dashboard.borrow.execution_page.view_transaction"
                              )}
                            </Text>
                          </Box>
                        ) : null}
                      </Box>
                    );
                  })}
                </Box>
              ))}
            </Box>
          ) : null}

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
