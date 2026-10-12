import { useAtomSet } from "@effect/atom-react";
import { useTranslation } from "react-i18next";
import { useWidgetConfig } from "../../../features/widget-configuration/index";
import { TransactionSteps } from "../../../shared/ui/components/transaction-steps";
import { Box } from "../../../shared/ui/primitives/box";
import { Button } from "../../../shared/ui/primitives/button";
import { CaretLeftIcon } from "../../../shared/ui/primitives/icons/caret-left";
import { Spinner } from "../../../shared/ui/primitives/spinner";
import { Text } from "../../../shared/ui/primitives/typography/text";
import { useTrackPage } from "../../tracking/index";
import {
  AnimationPage,
  PageContainer,
  PageCtaButton,
} from "../../widget-shell/views";
import {
  useBorrowTransactionFlow,
  useBorrowTransactionFlowExecution,
} from "../react/borrow-flow-route";
import { BorrowFlowHeading } from "./flow-heading";
import * as styles from "./styles.css";
import { useBorrowExecution } from "./use-borrow-execution";

export const BorrowStepsPage = () => {
  useTrackPage("borrowSteps");

  const dashboardVariant = useWidgetConfig("dashboardVariant");
  const { t } = useTranslation();
  const flow = useBorrowTransactionFlow();
  const executionFlow = useBorrowTransactionFlowExecution();
  const back = useAtomSet(executionFlow.backAtom);
  const execution = useBorrowExecution();
  const executionError = execution.error ?? execution.setupError;
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
                onClick={() => back(undefined)}
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
                ...step,
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

          {executionError && (
            <Box className={styles.executionError}>
              <Text variant={{ type: "danger" }}>
                {t("dashboard.borrow.execution_page.error_title")}
              </Text>
              <Text variant={{ type: "muted", weight: "normal" }}>
                {executionError.message}
              </Text>
            </Box>
          )}

          {executionError && (
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
              onClick: () => back(undefined),
              variant: "secondary",
            }}
          />
        </Box>
      </PageContainer>
    </AnimationPage>
  );
};
