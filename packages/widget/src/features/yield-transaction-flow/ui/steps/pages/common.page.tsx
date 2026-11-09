import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { isEthenaUsdeStaking } from "../../../../../domain/earn/yield";
import { Button, Notice, Stack, Text } from "../../../../../ui/index";
import { LeaveConfirmationDialog } from "../../../../leave-confirmation/views";
import {
  describeTransactionFailure,
  getTransactionStepState,
  useSlowTransactionStep,
} from "../../../../transaction-steps/index";
import {
  type TransactionStep,
  TransactionSteps,
} from "../../../../transaction-steps/views";
import { useWidgetConfig } from "../../../../widget-configuration/index";
import {
  AnimationPage,
  PageContainer,
  PageCtaButton,
  PageCtaSlot,
} from "../../../../widget-shell/views";
import {
  formatTransactionTypeLabel,
  type YieldStepRow,
} from "../../../model/yield-transaction-workflow";
import { useSteps } from "../hooks/use-steps.hook";

/** A preparation runs in the browser: one phase, with its own messages. */
const getPreparationStep = (
  t: TFunction,
  row: YieldStepRow,
  kind: "encrypt" | "decrypt"
): Pick<TransactionStep, "state" | "message"> => {
  switch (row.done ? "done" : row.phases.sign) {
    case "done":
      return { state: "done" };
    case "active":
      return { message: t(`steps.${kind}_desc`), state: "active" };
    case "failed":
      return {
        message: row.rejected
          ? t("steps.prepare_rejected")
          : t(`steps.${kind}_error`),
        state: "failed",
      };
    default:
      return { state: "pending" };
  }
};

export const StepsPage = () => {
  const { showsPendingApprovalsNotice } = useWidgetConfig("hostProfile");

  const {
    error,
    numbered,
    retry,
    txStates,
    cta,
    ctaNote,
    leaveConfirmationDialog,
    summary,
    details,
    wallet,
    yieldId,
  } = useSteps();

  const { t } = useTranslation();
  const slowStepId = useSlowTransactionStep(txStates);
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

  const steps = txStates.map((row, index): TransactionStep => {
    const type = formatTransactionTypeLabel(row.type, t, {
      context: isEthenaUsdeStaking(yieldId) ? "ETHENA_USDE" : undefined,
    });

    return {
      explorerUrl: row.explorerUrl,
      hash: row.hash,
      id: row.id,
      // Unnumbered: the singular form shows no index.
      label: t("steps.tx_of", {
        count: numbered ? txStates.length : 1,
        current: numbered ? index + 1 : undefined,
        type,
      }),
      type,
      ...(row.type === "ENCRYPT" || row.type === "DECRYPT"
        ? getPreparationStep(
            t,
            row,
            row.type === "ENCRYPT" ? "encrypt" : "decrypt"
          )
        : getTransactionStepState(t, {
            done: row.done,
            failure: stepFailure,
            phases: row.phases,
            slow: row.id === slowStepId,
          })),
    };
  });

  return (
    <AnimationPage>
      <PageContainer>
        <Stack gap={16}>
          <Text variant="title" as="h1">
            {t("steps.title")}
          </Text>

          {showsPendingApprovalsNotice && (
            <Notice tone="warning" title={t("steps.pending_approvals")}>
              {t("steps.pending_approvals_desc")}
            </Notice>
          )}

          <TransactionSteps
            {...(summary ? { summary } : {})}
            details={details}
            steps={steps}
            wallet={wallet}
          />
        </Stack>

        <PageCtaSlot>
          <Stack gap={12}>
            {retry && (
              <Button
                hostHook="footer-button-primary"
                onClick={retry}
                size="cta"
                variant="primary"
              >
                {t("shared.retry")}
              </Button>
            )}
            <PageCtaButton
              cta={cta}
              {...(ctaNote
                ? {
                    notice: (
                      <Text
                        as="p"
                        variant="caption"
                        tone="muted"
                        align="center"
                      >
                        {ctaNote}
                      </Text>
                    ),
                  }
                : {})}
            />
          </Stack>
        </PageCtaSlot>

        <LeaveConfirmationDialog {...leaveConfirmationDialog} />
      </PageContainer>
    </AnimationPage>
  );
};
