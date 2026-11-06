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
import {
  getBorrowTransactionFlowDestination,
  projectBorrowTransactionFlowSummary,
} from "../model/borrow-transaction-flow";
import {
  useBorrowTransactionFlow,
  useBorrowTransactionFlowExecution,
} from "../react/borrow-flow-route";
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
  // A borrow that failed after its collateral went in leaves that collateral
  // supplied: say so, and what the user can do about it.
  const collateralSupplied =
    failure !== null &&
    summary.action === "borrowAndSupply" &&
    execution.steps.some((step) => step.done && step.type === "SUPPLY");
  const partialOutcome = projected.collateral
    ? t("dashboard.borrow.execution_page.partial_supplied", {
        amount: `${formatTokenAmount(projected.collateral.amount, locale, "down")} ${projected.collateral.symbol}`,
      })
    : t("dashboard.borrow.execution_page.partial_supplied_without_amount");
  // The Notice names what already happened, else what failed. A rejection in
  // the wallet changed nothing, so its step alone says it.
  const failureNotice = execution.cancelled ? null : (failure?.message ?? null);
  const notice = collateralSupplied ? partialOutcome : failureNotice;
  // The failed step says what failed, or keeps the wallet's or API's own
  // words when the Notice already says it.
  const noticeRepeatsFailure = notice !== null && notice === failure?.message;
  const stepFailure = noticeRepeatsFailure
    ? (failure?.detail ?? null)
    : (failure?.message ?? null);
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
                  ...getTransactionStepState(
                    step.done,
                    step.progress.phases,
                    stepFailure
                  ),
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

          {notice && (
            <Notice
              tone="danger"
              title={t(
                `dashboard.borrow.execution_page.error_titles.${summary.action}`
              )}
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
                  label: t("shared.cancel"),
                  onClick: leave,
                  variant: "secondary",
                }}
              />
            </Stack>
          </PageCtaSlot>

          <LeaveConfirmationDialog {...leaveConfirmation.dialog} />
        </Stack>
      </PageContainer>
    </AnimationPage>
  );
};
