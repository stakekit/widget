import { useAtomSet } from "@effect/atom-react";
import { useTranslation } from "react-i18next";
import { IconButton, Notice, Spinner, Stack, Text } from "../../../ui/index";
import { useExecutionLeaveConfirmation } from "../../leave-confirmation/index";
import { LeaveConfirmationDialog } from "../../leave-confirmation/views";
import { useTrackPage } from "../../tracking/index";
import {
  getTransactionStepState,
  TransactionSteps,
} from "../../transaction-steps/views";
import {
  AnimationPage,
  PageContainer,
  PageCtaButton,
} from "../../widget-shell/views";
import { getBorrowTransactionFlowDestination } from "../model/borrow-transaction-flow";
import {
  useBorrowTransactionFlow,
  useBorrowTransactionFlowExecution,
} from "../react/borrow-flow-route";
import { BorrowFlowHeading } from "./flow-heading";
import { useBorrowExecution } from "./use-borrow-execution";

export const BorrowStepsPage = () => {
  useTrackPage("borrowSteps");

  const { t } = useTranslation();
  const flow = useBorrowTransactionFlow();
  const executionFlow = useBorrowTransactionFlowExecution();
  const back = useAtomSet(executionFlow.leaveAtom);
  const leaveConfirmation = useExecutionLeaveConfirmation(
    getBorrowTransactionFlowDestination(flow.intake.entry).completePath
  );
  const leave = () => leaveConfirmation.confirm(() => back(undefined));
  const execution = useBorrowExecution();
  const executionErrorMessage = execution.errorMessage;
  const isPositionFlow = flow.intake.entry._tag === "MarketPosition";
  const failed = Boolean(executionErrorMessage) || execution.cancelled;

  return (
    <AnimationPage>
      <PageContainer>
        <Stack hostHook="borrow-steps-page" gap={16}>
          <Stack gap={8}>
            {isPositionFlow ? (
              <IconButton
                icon="CaretLeftIcon"
                label={t("dashboard.borrow.review_page.back_to_position")}
                size="sm"
                onClick={leave}
              />
            ) : null}

            <BorrowFlowHeading summary={flow.intake.summary} />
          </Stack>

          {execution.totalSteps > 1 ? (
            <Text tone="muted">
              {t("dashboard.borrow.execution_page.batch_progress", {
                current: execution.currentStep,
                total: execution.totalSteps,
              })}
            </Text>
          ) : null}

          {execution.steps.length > 0 || failed ? (
            <TransactionSteps
              steps={execution.steps.map((step, index) => ({
                explorerUrl: step.explorerUrl,
                hash: step.hash,
                id: step.id,
                label: t("steps.tx_of", {
                  count: execution.steps.length,
                  current: index + 1,
                  type: t(
                    `dashboard.borrow.execution_page.tx_type.${step.type}`
                  ),
                }),
                ...getTransactionStepState(t, step.done, step.progress.phases),
              }))}
              {...(failed
                ? {
                    retry: {
                      hostHook: "borrow-steps-retry",
                      label: t("shared.retry"),
                      onClick: execution.retry,
                    },
                  }
                : {})}
            />
          ) : null}

          {execution.phase === "advancing" && execution.isRunning ? (
            <Stack direction="row" align="center" gap={12}>
              <Spinner />
              <Text tone="muted">
                {t("dashboard.borrow.execution_page.preparing_next_step")}
              </Text>
            </Stack>
          ) : null}

          {executionErrorMessage && (
            <Notice
              tone="danger"
              title={t(
                `dashboard.borrow.execution_page.error_titles.${flow.intake.summary.action}`
              )}
            >
              {executionErrorMessage}
            </Notice>
          )}

          {execution.cancelled && (
            <Notice tone="neutral">
              {t("dashboard.borrow.execution_page.cancelled")}
            </Notice>
          )}

          <PageCtaButton
            cta={{
              disabled: false,
              isLoading: false,
              label: t("shared.cancel"),
              onClick: leave,
              variant: "secondary",
            }}
          />

          <LeaveConfirmationDialog {...leaveConfirmation.dialog} />
        </Stack>
      </PageContainer>
    </AnimationPage>
  );
};
