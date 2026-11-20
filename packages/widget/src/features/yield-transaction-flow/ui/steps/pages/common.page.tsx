import { useAtomSet, useAtomValue } from "@effect/atom-react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";

import type { YieldAction } from "../../../../../domain/earn/action-models";
import { getConfidentialPreparationStep } from "../../../../../domain/earn/confidential-vault";
import { isEthenaUsdeStaking } from "../../../../../domain/earn/yield";
import type { YieldId } from "../../../../../domain/identity/identifiers";
import { Notice, Text } from "../../../../../ui/index";
import { useTrackEvent, useTrackPage } from "../../../../tracking/index";
import {
  type TransactionFlowStepsRow,
  TransactionFlowStepsPage,
} from "../../../../transaction-flow/views";
import { useConnectedWallet } from "../../../../wallet/index";
import { useWidgetConfig } from "../../../../widget-configuration/index";
import type { YieldPreviewIntake } from "../../../model/intake";
import {
  formatTransactionTypeLabel,
  type YieldStepRow,
} from "../../../model/yield-transaction-workflow";
import {
  useProvidedYieldFlowExecution,
  useYieldFlowSession,
} from "../../yield-flow-session";
import {
  useStepsDetails,
  useStepsSummary,
} from "../hooks/use-steps-summary.hook";

/** A preparation runs in the browser: one phase, with its own messages. */
const getPreparationStep = (
  t: TFunction,
  row: YieldStepRow,
  kind: "encrypt" | "decrypt"
): NonNullable<TransactionFlowStepsRow["placed"]> => {
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

/** The Yield workflow's rows as the Steps page frame lists them. */
export const getYieldStepsRows = (
  t: TFunction,
  {
    txStates,
    yieldId,
  }: {
    readonly txStates: ReadonlyArray<YieldStepRow>;
    readonly yieldId: YieldId;
  }
): ReadonlyArray<TransactionFlowStepsRow> => {
  const context = isEthenaUsdeStaking(yieldId) ? "ETHENA_USDE" : undefined;
  return txStates.map((row) => {
    const preparation = getConfidentialPreparationStep(row.type);
    return {
      done: row.done,
      explorerUrl: row.explorerUrl,
      hash: row.hash,
      id: row.id,
      phases: row.phases,
      type: formatTransactionTypeLabel(row.type, t, { context }),
      ...(preparation
        ? { placed: getPreparationStep(t, row, preparation) }
        : {}),
    };
  });
};

/** The intake a continued action's intent would have started. */
const intakeTagByIntent = {
  enter: "Enter",
  exit: "Exit",
  manage: "Manage",
} as const satisfies Record<YieldAction["intent"], YieldPreviewIntake["_tag"]>;

/** What Steps is tracked as: the journey the Execution runs. */
const stepsTrackPages = {
  Enter: "stakingSteps",
  Exit: "unstakeSteps",
  Manage: "pendingActionSteps",
} as const satisfies Record<YieldPreviewIntake["_tag"], string>;

/** The Yield flow's Steps: its transactions and what Review showed. */
export const StepsPage = () => {
  const { t } = useTranslation();
  const { destination } = useYieldFlowSession();
  const execution = useProvidedYieldFlowExecution();
  useTrackPage(
    stepsTrackPages[
      execution._tag === "YieldActionContinuation"
        ? intakeTagByIntent[execution.intake.action.intent]
        : execution._tag
    ]
  );
  const { steps } = useAtomValue(execution.workflow.viewAtom);
  const dispatch = useAtomSet(execution.workflow.dispatchAtom);
  const returnToReview = useAtomSet(execution.backAtom);
  const leaveFlow = useAtomSet(execution.finishAtom);
  const trackEvent = useTrackEvent();
  const summary = useStepsSummary();
  const details = useStepsDetails(execution);
  const wallet = useConnectedWallet();
  const { showsPendingApprovalsNotice } = useWidgetConfig("hostProfile");

  return (
    <TransactionFlowStepsPage
      title={
        <Text variant="title" as="h1">
          {t("steps.title")}
        </Text>
      }
      notice={
        showsPendingApprovalsNotice ? (
          <Notice tone="warning" title={t("steps.pending_approvals")}>
            {t("steps.pending_approvals_desc")}
          </Notice>
        ) : null
      }
      rows={getYieldStepsRows(t, steps)}
      numbered={steps.numbered}
      error={steps.error}
      retry={steps.retryable ? () => dispatch({ _tag: "Retry" }) : null}
      retryHostHook="footer-button-primary"
      sent={steps.sent}
      resumable={steps.resumable}
      completePath={destination.completePath}
      onCancel={() => {
        returnToReview(undefined);
        trackEvent("actionStepsCancelled");
      }}
      onLeave={() => leaveFlow(undefined)}
      {...(summary ? { summary } : {})}
      details={details}
      wallet={wallet}
    />
  );
};
