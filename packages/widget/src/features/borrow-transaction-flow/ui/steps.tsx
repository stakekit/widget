import { useAtomSet } from "@effect/atom-react";
import { useTranslation } from "react-i18next";

import {
  formatBorrowProviderName,
  formatNetworkName,
} from "../../../shared/lib/formatters";
import {
  formatTokenAmount,
  formatUsd,
} from "../../../shared/lib/number-format";
import { useWidgetPresentation } from "../../../shared/react/widget-presentation";
import {
  Button,
  IconButton,
  InlineIcon,
  Notice,
  Spinner,
  Stack,
  Text,
} from "../../../ui/index";
import { useExecutionLeaveConfirmation } from "../../leave-confirmation/index";
import { LeaveConfirmationDialog } from "../../leave-confirmation/views";
import { useTrackPage } from "../../tracking/index";
import {
  describeTransactionFailure,
  getTransactionStepState,
  useSlowTransactionStep,
} from "../../transaction-steps/index";
import {
  TransactionSteps,
  type TransactionStepsDetail,
} from "../../transaction-steps/views";
import { useConnectedWallet } from "../../wallet/index";
import {
  AnimationPage,
  PageContainer,
  PageCtaButton,
  PageCtaSlot,
} from "../../widget-shell/views";
import { getBorrowFlowHeadline } from "../model/borrow-completion";
import { projectBorrowTransactionFlowSummary } from "../model/review";
import { getBorrowTransactionFlowDestination } from "../model/session";
import {
  useBorrowTransactionFlow,
  useBorrowTransactionFlowExecution,
} from "./borrow-flow-session";
import { BorrowFlowHeading } from "./flow-heading";
import { useBorrowExecution } from "./use-borrow-execution";

export const BorrowStepsPage = () => {
  useTrackPage("borrowSteps");

  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();
  const wallet = useConnectedWallet();
  const flow = useBorrowTransactionFlow();
  const executionFlow = useBorrowTransactionFlowExecution();
  const back = useAtomSet(executionFlow.leaveAtom);
  // Borrow actions are not continued from Activity.
  const leaveConfirmation = useExecutionLeaveConfirmation(
    getBorrowTransactionFlowDestination(flow.intake.entry).completePath,
    { resumable: false }
  );
  const leave = () => leaveConfirmation.confirm(() => back(undefined));
  const execution = useBorrowExecution();
  const isPositionFlow = flow.intake.entry._tag === "MarketPosition";
  const failure = describeTransactionFailure(t, execution.error);
  // What Review showed, under the steps: the amount with its value, and the
  // market with who runs it. Gas is not estimated before the steps run.
  const { summary } = flow.intake;
  const projected = projectBorrowTransactionFlowSummary(summary);
  const headline = getBorrowFlowHeadline(summary, projected);
  // A borrow that stopped after its collateral went in says so, and what the
  // user can do about it.
  const partialOutcome = projected.collateral
    ? t("dashboard.borrow.execution_page.partial_supplied", {
        amount: `${formatTokenAmount(projected.collateral.amount, locale, "down")} ${projected.collateral.symbol}`,
      })
    : t("dashboard.borrow.execution_page.partial_supplied_without_amount");
  // The Notice names what already happened, else what failed. A request
  // declined in the wallet changed nothing, so its step alone says it.
  const failureNotice = failure?.cancelled ? null : (failure?.message ?? null);
  const notice = execution.collateralSupplied ? partialOutcome : failureNotice;
  // The failed step says what failed, or keeps the wallet's or API's own
  // words when the Notice already says it.
  const noticeRepeatsFailure = notice !== null && notice === failure?.message;
  const stepFailure = failure
    ? {
        cancelled: failure.cancelled,
        message: noticeRepeatsFailure ? failure.detail : failure.message,
      }
    : null;
  const slowStepId = useSlowTransactionStep(
    execution.steps.map(({ done, id, progress }) => ({
      done,
      id,
      phases: progress.phases,
    }))
  );
  // What is sent cannot be called back: the footer offers Leave, not Cancel.
  const { sent } = execution;
  const details: ReadonlyArray<TransactionStepsDetail> = [
    ...(headline.amount === null
      ? []
      : [
          {
            label: t("steps.details.amount"),
            testId: "steps-details-amount",
            value: `${formatTokenAmount(headline.amount, locale, "down")} ${headline.symbol}`,
            ...(headline.usd
              ? { caption: formatUsd(headline.usd, locale) }
              : {}),
          },
        ]),
    {
      caption: `${formatBorrowProviderName(summary.providerName)} · ${formatNetworkName(summary.network)}`,
      label: t("steps.details.market"),
      testId: "steps-details-market",
      value: summary.marketLabel,
    },
  ];

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
            <TransactionSteps
              details={details}
              wallet={wallet}
              steps={execution.steps.map((step, index) => {
                const type = t(
                  `dashboard.borrow.execution_page.tx_type.${step.type}`
                );
                return {
                  explorerUrl: step.explorerUrl,
                  hash: step.hash,
                  id: step.id,
                  label: t("steps.tx_of", {
                    count: execution.steps.length,
                    current: index + 1,
                    type,
                  }),
                  type,
                  ...getTransactionStepState(t, {
                    done: step.done,
                    failure: stepFailure,
                    phases: step.progress.phases,
                    slow: step.id === slowStepId,
                  }),
                };
              })}
            />
          ) : null}

          {execution.phase === "advancing" && execution.isRunning ? (
            <Text tone="muted">
              <InlineIcon variant="body" gap={8}>
                <Spinner />
              </InlineIcon>
              {t("dashboard.borrow.execution_page.preparing_next_step")}
            </Text>
          ) : null}

          {/* Declining in the wallet is not an error: only a real failure
              reads in danger and is titled as one. */}
          {notice && (
            <Notice
              tone={failure?.cancelled ? "warning" : "danger"}
              {...(failure?.cancelled
                ? {}
                : {
                    title: t(
                      `dashboard.borrow.execution_page.error_titles.${summary.action}`
                    ),
                  })}
            >
              {notice}
            </Notice>
          )}

          <PageCtaSlot>
            <Stack gap={12}>
              {failure && (
                <Button
                  hostHook="borrow-steps-retry"
                  onClick={execution.retry}
                  size="cta"
                  variant="primary"
                >
                  {t("shared.retry")}
                </Button>
              )}
              <PageCtaButton
                cta={{
                  disabled: false,
                  isLoading: false,
                  label: sent ? t("steps.leave") : t("shared.cancel"),
                  onClick: leave,
                  variant: "secondary",
                }}
                {...(sent
                  ? {
                      notice: (
                        <Text
                          as="p"
                          variant="caption"
                          tone="muted"
                          align="center"
                        >
                          {t("steps.sent_note")}
                        </Text>
                      ),
                    }
                  : {})}
              />
            </Stack>
          </PageCtaSlot>

          <LeaveConfirmationDialog {...leaveConfirmation.dialog} />
        </Stack>
      </PageContainer>
    </AnimationPage>
  );
};
