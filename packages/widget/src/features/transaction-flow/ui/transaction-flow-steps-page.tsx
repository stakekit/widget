import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import type { TransactionHash } from "../../../domain/identity/identifiers";
import type { WidgetPath } from "../../../services/navigation/widget-routes";
import type {
  TransactionPhaseProgress,
  TransactionWorkflowError,
} from "../../../services/transaction-workflow/transaction-workflow-model";
import { Button, type HostHook, Stack, Text } from "../../../ui/index";
import { useExecutionLeaveConfirmation } from "../../leave-confirmation/index";
import { LeaveConfirmationDialog } from "../../leave-confirmation/views";
import {
  describeTransactionFailure,
  getTransactionStepState,
  useSlowTransactionStep,
} from "../../transaction-steps/index";
import {
  type TransactionStep,
  TransactionSteps,
  type TransactionStepsDetail,
} from "../../transaction-steps/views";
import {
  AnimationPage,
  PageContainer,
  PageCtaButton,
  PageCtaSlot,
} from "../../widget-shell/views";
import { TransactionFlowPageHeader } from "./transaction-flow-page-header";

/** One transaction of the Execution, as the flow's workflow reports it. */
export type TransactionFlowStepsRow = Readonly<{
  readonly done: boolean;
  readonly explorerUrl: string | null;
  readonly hash: TransactionHash | null;
  readonly id: string;
  readonly phases: TransactionPhaseProgress;
  /** What the transaction does, such as "Approval", already translated. */
  readonly type: string;
  /**
   * Where a step the flow runs itself stands, such as a preparation in the
   * browser; unset, its phases place it.
   */
  readonly placed?: Pick<TransactionStep, "message" | "state">;
}>;

type TransactionFlowStepsPageProps = Readonly<{
  /** The flow's heading, under the breadcrumb. */
  readonly title: ReactNode;
  /**
   * What the flow adds over the steps, such as an outcome so far or a notice
   * its host asks for.
   */
  readonly notice?: ReactNode;
  /** A line under the steps, such as the next step being prepared. */
  readonly status?: ReactNode;
  readonly rows: ReadonlyArray<TransactionFlowStepsRow>;
  /** Unnumbered steps show no index. */
  readonly numbered: boolean;
  readonly error: TransactionWorkflowError | null;
  /** Retries the failed step; null when it cannot be retried. */
  readonly retry: (() => void) | null;
  /** A transaction went out: the footer offers Leave, not Cancel. */
  readonly sent: boolean;
  /** Leaving lets the Execution be continued from Activity. */
  readonly resumable: boolean;
  /** Complete, where leaving needs no confirmation. */
  readonly completePath: WidgetPath;
  /** Cancels before anything was sent, once the user confirmed. */
  readonly onCancel: () => void;
  /** Leaves what was sent running, once the user confirmed. */
  readonly onLeave: () => void;
  readonly summary?: Parameters<typeof TransactionSteps>[0]["summary"];
  readonly details: ReadonlyArray<TransactionStepsDetail>;
  readonly wallet: NonNullable<
    Parameters<typeof TransactionSteps>[0]["wallet"]
  > | null;
  readonly hostHook?: HostHook;
  readonly retryHostHook: HostHook;
}>;

/**
 * A flow's Steps page, worded the same in every flow: the transactions with
 * what failed on its step only, a retry, and Cancel, or Leave once anything
 * was sent, each confirmed before the page lets the Execution go.
 */
export const TransactionFlowStepsPage = ({
  completePath,
  details,
  error,
  hostHook,
  notice,
  numbered,
  onCancel,
  onLeave,
  resumable,
  retry,
  retryHostHook,
  rows,
  sent,
  status,
  summary,
  title,
  wallet,
}: TransactionFlowStepsPageProps) => {
  const { t } = useTranslation();
  const leaveConfirmation = useExecutionLeaveConfirmation(completePath, {
    resumable,
  });
  // What is sent cannot be called back: leaving lets it run on, out of the
  // flow, rather than back to a Review that could send it again.
  const leave = () => leaveConfirmation.confirm(sent ? onLeave : onCancel);
  const slowStepId = useSlowTransactionStep(rows);
  // One surface for what failed: its step, with the wallet's or API's own
  // words after the plain message.
  const failure = describeTransactionFailure(t, error);
  const failureDetail = failure?.detail
    ? ` ${t("steps.failure.detail", { detail: failure.detail })}`
    : "";
  const stepFailure = failure
    ? {
        cancelled: failure.cancelled,
        message: `${failure.message}${failureDetail}`,
      }
    : null;

  const steps = rows.map((row, index): TransactionStep => ({
    explorerUrl: row.explorerUrl,
    hash: row.hash,
    id: row.id,
    label: t("steps.tx_of", {
      count: numbered ? rows.length : 1,
      current: numbered ? index + 1 : undefined,
      type: row.type,
    }),
    type: row.type,
    ...(row.placed ??
      getTransactionStepState(t, {
        done: row.done,
        failure: stepFailure,
        phases: row.phases,
        slow: row.id === slowStepId,
      })),
  }));

  return (
    <AnimationPage>
      <PageContainer>
        <Stack gap={16} {...(hostHook ? { hostHook } : {})}>
          <TransactionFlowPageHeader back={leave} page="Steps" />

          {title}

          {notice}

          {steps.length > 0 && (
            <TransactionSteps
              {...(summary ? { summary } : {})}
              details={details}
              steps={steps}
              wallet={wallet}
            />
          )}

          {status}
        </Stack>

        <PageCtaSlot>
          <Stack gap={12}>
            {retry && (
              <Button
                hostHook={retryHostHook}
                onClick={retry}
                size="cta"
                variant="primary"
              >
                {t("shared.retry")}
              </Button>
            )}
            <PageCtaButton
              cta={
                steps.length > 0
                  ? {
                      disabled: false,
                      isLoading: false,
                      label: sent ? t("steps.leave") : t("shared.cancel"),
                      onClick: leave,
                      variant: "secondary",
                    }
                  : null
              }
              {...(sent
                ? {
                    // Why there is no Cancel once a transaction is sent.
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
      </PageContainer>
    </AnimationPage>
  );
};
