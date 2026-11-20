import { createContext, useContext } from "react";
import { useTranslation } from "react-i18next";

import { PageHeader } from "../../../ui/index";
import type { TransactionFlowTrail } from "../model/trail";

export const TransactionFlowTrailContext =
  createContext<TransactionFlowTrail | null>(null);

/** A flow page's name in its breadcrumb. */
type TransactionFlowPage = "Complete" | "Review" | "Steps";

const pageTitleKeys = {
  Complete: "transaction_steps.page_title.complete",
  Review: "transaction_steps.page_title.review",
  Steps: "transaction_steps.page_title.steps",
} as const satisfies Record<TransactionFlowPage, string>;

/**
 * The flow page's back button and breadcrumb, when its composition gives a
 * trail; otherwise the page around the flow, or the shell, offers back.
 */
export const TransactionFlowPageHeader = ({
  back,
  page,
}: {
  readonly back: () => void;
  readonly page: TransactionFlowPage;
}) => {
  const { t } = useTranslation();
  const trail = useContext(TransactionFlowTrailContext);
  if (!trail) return null;
  return (
    <PageHeader
      back={{
        label: t("shared.back"),
        onClick: back,
        testId: "transaction-flow-back",
      }}
      parent={t(trail.parent)}
      title={t(pageTitleKeys[page])}
    />
  );
};
