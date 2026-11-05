import type { TFunction } from "i18next";
import type { ComponentProps } from "react";
import { useTranslation } from "react-i18next";
import type { TransactionHash } from "../../../domain/identity/identifiers";
import type { TransactionPhaseProgress } from "../../../services/transaction-workflow/transaction-workflow-model";
import { formatTransactionHash } from "../../../shared/lib/general";
import { FlowSteps } from "../../../ui/index";

type FlowStepsProps = ComponentProps<typeof FlowSteps>;
type FlowStep = FlowStepsProps["steps"][number];

/** One transaction of a flow, with where it is found once it was sent. */
export type TransactionStep = Omit<FlowStep, "explorerUrl" | "hash"> & {
  readonly explorerUrl: string | null;
  readonly hash: TransactionHash | null;
};

type TransactionStepsProps = Pick<FlowStepsProps, "summary"> & {
  readonly steps: ReadonlyArray<TransactionStep>;
};

/**
 * Where a transaction's sign, broadcast and confirm phases put its step, with
 * what went wrong once one failed.
 */
export const getTransactionStepState = (
  t: TFunction,
  done: boolean,
  phases: TransactionPhaseProgress
): Pick<TransactionStep, "state" | "message"> => {
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

/**
 * A flow's transactions as its Steps page shows them: how many are
 * confirmed, each state by name, and each done transaction's short hash
 * linking to its block explorer. A step not yet done shows no link, so a
 * transaction still being sent or confirmed reads as unfinished.
 */
export const TransactionSteps = ({ steps, ...flow }: TransactionStepsProps) => {
  const { t } = useTranslation();

  return (
    <FlowSteps
      {...flow}
      label={t("steps.progress_label")}
      progressLabel={({ confirmed, total }) =>
        t("steps.progress_count", { confirmed, total })
      }
      stateLabels={{
        active: t("steps.state.active"),
        broadcasting: t("steps.state.broadcasting"),
        done: t("steps.state.done"),
        failed: t("steps.state.failed"),
        pending: t("steps.state.pending"),
        signing: t("steps.state.signing"),
      }}
      explorerLink={{
        label: t("steps.view_transaction"),
        newTabLabel: t("shared.opens_in_new_tab"),
      }}
      steps={steps.map(({ explorerUrl, hash, ...step }) =>
        step.state === "done" && explorerUrl !== null
          ? {
              ...step,
              explorerUrl,
              ...(hash === null ? {} : { hash: formatTransactionHash(hash) }),
            }
          : step
      )}
    />
  );
};
