import { useAtomSet } from "@effect/atom-react";
import type { TFunction } from "i18next";
import type { ComponentProps } from "react";
import { useTranslation } from "react-i18next";
import type { TransactionPhaseProgress } from "../../../services/transaction-workflow/transaction-workflow-model";
import {
  Button,
  FlowSteps,
  IconButton,
  Notice,
  Spinner,
  Stack,
  Text,
} from "../../../ui/index";
import { useExecutionLeaveConfirmation } from "../../leave-confirmation/index";
import { LeaveConfirmationDialog } from "../../leave-confirmation/views";
import { useTrackPage } from "../../tracking/index";
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

type FlowStep = ComponentProps<typeof FlowSteps>["steps"][number];

/** Where a transaction's sign, broadcast and confirm phases put it. */
const toFlowStepState = (
  t: TFunction,
  done: boolean,
  phases: TransactionPhaseProgress
): Pick<FlowStep, "state" | "message"> => {
  if (done) return { state: "done" };
  if (phases.sign === "failed") {
    return { message: t("steps.approve_error"), state: "failed" };
  }
  if (phases.broadcast === "failed" || phases.confirm === "failed") {
    return { message: t("shared.something_went_wrong"), state: "failed" };
  }
  if (phases.sign === "active") return { state: "signing" };
  if (phases.broadcast === "active") return { state: "broadcasting" };
  if (phases.confirm === "active") return { state: "active" };
  if (phases.confirm === "done") return { state: "done" };
  return { state: "pending" };
};

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

          {execution.steps.length > 0 ? (
            <FlowSteps
              label={t("steps.progress_label")}
              stateLabels={{
                active: t("steps.state.active"),
                broadcasting: t("steps.state.broadcasting"),
                done: t("steps.state.done"),
                failed: t("steps.state.failed"),
                pending: t("steps.state.pending"),
                signing: t("steps.state.signing"),
              }}
              explorerLink={{
                label: t("dashboard.borrow.success_page.view_on_explorer"),
                newTabLabel: t("shared.opens_in_new_tab"),
              }}
              steps={execution.steps.map((step, index) => ({
                id: step.id,
                label: t("steps.tx_of", {
                  count: execution.steps.length,
                  current: index + 1,
                  type: t(
                    `dashboard.borrow.execution_page.tx_type.${step.type}`
                  ),
                }),
                ...toFlowStepState(t, step.done, step.progress.phases),
                ...(step.explorerUrl ? { explorerUrl: step.explorerUrl } : {}),
              }))}
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

          {(executionErrorMessage || execution.cancelled) && (
            <Button
              hostHook="borrow-steps-retry"
              onClick={execution.retry}
              variant="primary"
              size="lg"
            >
              {t("shared.retry")}
            </Button>
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
