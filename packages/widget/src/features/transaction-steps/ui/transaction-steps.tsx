import type { TFunction } from "i18next";
import type { ComponentProps } from "react";
import { useTranslation } from "react-i18next";

import type { TransactionHash } from "../../../domain/identity/identifiers";
import type { TransactionPhaseProgress } from "../../../services/transaction-workflow/transaction-workflow-model";
import { formatTransactionHash } from "../../../shared/lib/general";
import { FlowSteps } from "../../../ui/index";
import { isInFlight } from "../model/transaction-step";
import type { TransactionFailure } from "./transaction-failure";

type FlowStepsProps = ComponentProps<typeof FlowSteps>;
type FlowStep = FlowStepsProps["steps"][number];

/** One transaction of a flow, with where it is found once it was sent. */
export type TransactionStep = Omit<FlowStep, "explorerUrl" | "hash"> & {
  readonly explorerUrl: string | null;
  readonly hash: TransactionHash | null;
  /** What the transaction does, such as "Approval": named in the wallet prompt. */
  readonly type: string;
};

/** The wallet asked for signatures: its name and logo, once known. */
type TransactionStepsWallet = {
  readonly name: string;
  readonly logo?: string;
};

/** One row of the details under the steps, such as the amount. */
export type TransactionStepsDetail = NonNullable<
  FlowStepsProps["details"]
>[number];

type TransactionStepsProps = Pick<FlowStepsProps, "summary" | "details"> & {
  readonly steps: ReadonlyArray<TransactionStep>;
  readonly wallet?: TransactionStepsWallet | null;
};

/** What a step's failure says: its message, and whether the user declined. */
type TransactionStepFailure = Pick<TransactionFailure, "cancelled"> & {
  readonly message: string | null;
};

/**
 * Where a transaction's sign, broadcast and confirm phases put its step, with
 * `failure`, what went wrong, once one failed: a request declined in the
 * wallet reads as cancelled, not failed. A step sent to the network that
 * `slow`ly confirms says it is taking longer than usual; one waiting for the
 * user's signature never does.
 */
export const getTransactionStepState = (
  t: TFunction,
  {
    done,
    failure,
    phases,
    slow,
  }: {
    readonly done: boolean;
    readonly failure: TransactionStepFailure | null;
    readonly phases: TransactionPhaseProgress;
    readonly slow: boolean;
  }
): Pick<TransactionStep, "state" | "message"> => {
  if (done) return { state: "done" };
  if (
    phases.sign === "failed" ||
    phases.broadcast === "failed" ||
    phases.confirm === "failed"
  ) {
    const state = failure?.cancelled ? "cancelled" : "failed";
    return failure?.message ? { message: failure.message, state } : { state };
  }
  if (phases.sign === "active") return { state: "signing" };
  const slowMessage =
    slow && isInFlight(phases) ? { message: t("steps.slow") } : {};
  if (phases.broadcast === "active") {
    return { state: "broadcasting", ...slowMessage };
  }
  if (phases.confirm === "active") return { state: "active", ...slowMessage };
  if (phases.confirm === "done") return { state: "done" };
  return { state: "pending" };
};

/** The card asking to approve a `type` transaction in the wallet. */
const getSignaturePrompt = (
  t: TFunction,
  type: string,
  wallet: TransactionStepsWallet | null | undefined
): NonNullable<FlowStepsProps["signaturePrompt"]> => {
  const title = t("steps.check_wallet.title");
  if (!wallet) {
    return {
      title,
      description: t("steps.check_wallet.description_unknown_wallet", {
        type,
      }),
    };
  }
  return {
    title,
    description: t("steps.check_wallet.description", {
      type,
      wallet: wallet.name,
    }),
    wallet,
  };
};

/**
 * A flow's transactions as its Steps page shows them: how many are
 * confirmed, each state by name, and the short hash of each transaction
 * sent to the network with a link to its block explorer, from the moment it
 * is broadcast. While a step waits for its signature, a card asks to approve
 * it in the wallet, named and shown once known.
 */
export const TransactionSteps = ({
  steps,
  wallet,
  ...flow
}: TransactionStepsProps) => {
  const { t } = useTranslation();
  const signing = steps.find((step) => step.state === "signing");

  return (
    <FlowSteps
      {...flow}
      {...(signing === undefined
        ? {}
        : { signaturePrompt: getSignaturePrompt(t, signing.type, wallet) })}
      label={t("steps.progress_label")}
      progressLabel={({ confirmed, total }) =>
        t("steps.progress_count", { confirmed, total })
      }
      stateLabels={{
        active: t("steps.state.active"),
        broadcasting: t("steps.state.broadcasting"),
        cancelled: t("steps.state.cancelled"),
        done: t("steps.state.done"),
        failed: t("steps.state.failed"),
        pending: t("steps.state.pending"),
        signing: t("steps.state.signing"),
      }}
      explorerLink={{
        label: t("steps.view_transaction"),
        newTabLabel: t("shared.opens_in_new_tab"),
      }}
      steps={steps.map(({ explorerUrl, hash, type: _type, ...step }) => ({
        ...step,
        ...(explorerUrl === null ? {} : { explorerUrl }),
        ...(hash === null ? {} : { hash: formatTransactionHash(hash) }),
      }))}
    />
  );
};
