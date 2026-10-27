import { useAtomSet } from "@effect/atom-react";
import { useTranslation } from "react-i18next";
import {
  getTransactionStepPhases,
  TransactionSteps,
} from "../../../shared/ui/components/transaction-steps";
import { Box } from "../../../shared/ui/primitives/box";
import { Button } from "../../../shared/ui/primitives/button";
import { CaretLeftIcon } from "../../../shared/ui/primitives/icons/caret-left";
import { Spinner } from "../../../shared/ui/primitives/spinner";
import { Text } from "../../../shared/ui/primitives/typography/text";
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
import * as styles from "./styles.css";
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
            {isPositionFlow ? (
              <Box
                aria-label={t("dashboard.borrow.review_page.back_to_position")}
                as="button"
                className={styles.flowBackButton}
                onClick={leave}
                type="button"
              >
                <CaretLeftIcon />
              </Box>
            ) : null}

            <BorrowFlowHeading summary={flow.intake.summary} />
          </Box>

          {execution.totalSteps > 1 ? (
            <Text variant={{ type: "muted", weight: "normal" }}>
              {t("dashboard.borrow.execution_page.batch_progress", {
                current: execution.currentStep,
                total: execution.totalSteps,
              })}
            </Text>
          ) : null}

          {execution.steps.length > 0 ? (
            <TransactionSteps
              steps={execution.steps.map((step) => ({
                done: step.done,
                explorerUrl: step.explorerUrl,
                id: step.id,
                phases: getTransactionStepPhases(t, step.progress.phases),
                type: t(`dashboard.borrow.execution_page.tx_type.${step.type}`),
              }))}
            />
          ) : null}

          {execution.phase === "advancing" && execution.isRunning ? (
            <Box alignItems="center" display="flex" gap="3">
              <Spinner />
              <Text variant={{ type: "muted", weight: "normal" }}>
                {t("dashboard.borrow.execution_page.preparing_next_step")}
              </Text>
            </Box>
          ) : null}

          {executionErrorMessage && (
            <Box className={styles.executionError}>
              <Text variant={{ type: "danger" }}>
                {t(
                  `dashboard.borrow.execution_page.error_titles.${flow.intake.summary.action}`
                )}
              </Text>
              <Text variant={{ type: "muted", weight: "normal" }}>
                {executionErrorMessage}
              </Text>
            </Box>
          )}

          {execution.cancelled && (
            <Text variant={{ type: "muted", weight: "normal" }}>
              {t("dashboard.borrow.execution_page.cancelled")}
            </Text>
          )}

          {(executionErrorMessage || execution.cancelled) && (
            <Button
              data-rk="borrow-steps-retry"
              onClick={execution.retry}
              variant={{ size: "layout" }}
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
        </Box>
      </PageContainer>
    </AnimationPage>
  );
};
