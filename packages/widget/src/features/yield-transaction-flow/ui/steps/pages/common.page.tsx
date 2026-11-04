import type { TFunction } from "i18next";
import type { ComponentProps } from "react";
import { useTranslation } from "react-i18next";
import { isEthenaUsdeStaking } from "../../../../../domain/earn/yield";
import {
  Button,
  FlowSteps,
  Notice,
  Stack,
  Text,
} from "../../../../../ui/index";
import { LeaveConfirmationDialog } from "../../../../leave-confirmation/views";
import { useWidgetConfig } from "../../../../widget-configuration/index";
import {
  AnimationPage,
  PageContainer,
  PageCtaButton,
} from "../../../../widget-shell/views";
import {
  formatTransactionTypeLabel,
  type YieldStepRow,
} from "../../../model/yield-transaction-workflow";
import { useSteps } from "../hooks/use-steps.hook";

type FlowStep = ComponentProps<typeof FlowSteps>["steps"][number];

/** Where a row's sign, broadcast and confirm phases put it as a flow step. */
const getStepState = ({
  done,
  phases,
}: YieldStepRow): Pick<FlowStep, "state"> & {
  readonly failedPhase?: "sign" | "broadcast" | "confirm";
} => {
  if (done) return { state: "done" };
  if (phases.sign === "failed") return { failedPhase: "sign", state: "failed" };
  if (phases.broadcast === "failed") {
    return { failedPhase: "broadcast", state: "failed" };
  }
  if (phases.confirm === "failed") {
    return { failedPhase: "confirm", state: "failed" };
  }
  if (phases.sign === "active") return { state: "signing" };
  if (phases.broadcast === "active") return { state: "broadcasting" };
  if (phases.confirm === "active") return { state: "active" };
  if (phases.confirm === "done") return { state: "done" };
  return { state: "pending" };
};

/** A preparation runs in the browser: one phase, with its own messages. */
const getPreparationStep = (
  t: TFunction,
  row: YieldStepRow,
  kind: "encrypt" | "decrypt"
): Pick<FlowStep, "state" | "message"> => {
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

const getTransactionStep = (
  t: TFunction,
  row: YieldStepRow
): Pick<FlowStep, "state" | "message"> => {
  const { failedPhase, state } = getStepState(row);
  if (failedPhase === undefined) return { state };
  return {
    message:
      failedPhase === "sign"
        ? t("steps.approve_error")
        : t("shared.something_went_wrong"),
    state,
  };
};

export const StepsPage = () => {
  const { showsPendingApprovalsNotice } = useWidgetConfig("hostProfile");

  const {
    cancelled,
    numbered,
    retry,
    txStates,
    cta,
    customSignErrorMessage,
    leaveConfirmationDialog,
    yieldId,
  } = useSteps();

  const { t } = useTranslation();

  const steps = txStates.map((row, index): FlowStep => {
    const type = formatTransactionTypeLabel(row.type, t, {
      context: isEthenaUsdeStaking(yieldId) ? "ETHENA_USDE" : undefined,
    });
    const progress =
      row.type === "ENCRYPT" || row.type === "DECRYPT"
        ? getPreparationStep(
            t,
            row,
            row.type === "ENCRYPT" ? "encrypt" : "decrypt"
          )
        : getTransactionStep(t, row);

    return {
      id: row.id,
      // Unnumbered: the singular form shows no index.
      label: t("steps.tx_of", {
        count: numbered ? txStates.length : 1,
        current: numbered ? index + 1 : undefined,
        type,
      }),
      ...progress,
    };
  });

  return (
    <AnimationPage>
      <PageContainer>
        <Stack gap={16}>
          <Text variant="title" as="h1">
            {t("steps.title")}
          </Text>

          {customSignErrorMessage && (
            <Notice tone="danger">{customSignErrorMessage}</Notice>
          )}

          {cancelled && (
            <Text as="p" tone="muted">
              {t("steps.cancelled")}
            </Text>
          )}

          {showsPendingApprovalsNotice && (
            <Notice tone="warning" title={t("steps.pending_approvals")}>
              {t("steps.pending_approvals_desc")}
            </Notice>
          )}

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
            steps={steps}
          />

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
        </Stack>

        <PageCtaButton cta={cta} />

        <LeaveConfirmationDialog {...leaveConfirmationDialog} />
      </PageContainer>
    </AnimationPage>
  );
};
