import type { TFunction } from "i18next";
import type { ComponentProps } from "react";
import { useTranslation } from "react-i18next";
import type { TransactionHash } from "../../../domain/identity/identifiers";
import { formatTransactionHash } from "../../../shared/lib/general";
import { FlowSteps } from "../../../ui/index";

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
      signaturePrompt={
        signing === undefined
          ? undefined
          : getSignaturePrompt(t, signing.type, wallet)
      }
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
