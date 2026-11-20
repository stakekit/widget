import { useAtomSet } from "@effect/atom-react";
import { useTranslation } from "react-i18next";

import { formatNetworkName } from "../../../shared/lib/formatters";
import {
  formatTokenAmount,
  formatUsd,
} from "../../../shared/lib/number-format";
import { useWidgetPresentation } from "../../../shared/react/widget-presentation";
import { InlineIcon, Notice, Spinner, Text } from "../../../ui/index";
import { formatBorrowProviderName } from "../../borrow-presentation/index";
import { useTrackPage } from "../../tracking/index";
import { TransactionFlowStepsPage } from "../../transaction-flow/views";
import type { TransactionStepsDetail } from "../../transaction-steps/views";
import { useConnectedWallet } from "../../wallet/index";
import { getBorrowFlowHeadline } from "../model/borrow-completion";
import { projectBorrowTransactionFlowSummary } from "../model/review";
import { getBorrowTransactionFlowDestination } from "../model/session";
import {
  useBorrowFlowSession,
  useProvidedBorrowFlowExecution,
} from "./borrow-flow-session";
import { BorrowFlowHeading } from "./flow-heading";
import { useBorrowExecution } from "./use-borrow-execution";

export const BorrowStepsPage = () => {
  useTrackPage("borrowSteps");

  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();
  const wallet = useConnectedWallet();
  const flow = useBorrowFlowSession();
  const leave = useAtomSet(useProvidedBorrowFlowExecution().leaveAtom);
  const execution = useBorrowExecution();
  // What Review showed, under the steps: the amount with its value, and the
  // market with who runs it. Gas is not estimated before the steps run.
  const { summary } = flow.intake;
  const projected = projectBorrowTransactionFlowSummary(summary);
  const headline = getBorrowFlowHeadline(summary, projected);
  // A borrow that stopped after its collateral went in says so, and what the
  // user can do about it; what failed shows on its step.
  const partialOutcome = projected.collateral
    ? t("borrow.execution_page.partial_supplied", {
        amount: `${formatTokenAmount(projected.collateral.amount, locale, "down")} ${projected.collateral.symbol}`,
      })
    : t("borrow.execution_page.partial_supplied_without_amount");
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
    <TransactionFlowStepsPage
      hostHook="borrow-steps-page"
      title={<BorrowFlowHeading summary={summary} />}
      notice={
        execution.collateralSupplied ? (
          <Notice tone="warning">{partialOutcome}</Notice>
        ) : null
      }
      status={
        execution.phase === "advancing" && execution.isRunning ? (
          <Text tone="muted">
            <InlineIcon variant="body" gap={8}>
              <Spinner />
            </InlineIcon>
            {t("borrow.execution_page.preparing_next_step")}
          </Text>
        ) : null
      }
      rows={execution.steps.map((step) => ({
        done: step.done,
        explorerUrl: step.explorerUrl,
        hash: step.hash,
        id: step.id,
        phases: step.progress.phases,
        type: t(`borrow.execution_page.tx_type.${step.type}`),
      }))}
      numbered
      error={execution.error}
      retry={execution.error ? execution.retry : null}
      retryHostHook="borrow-steps-retry"
      sent={execution.sent}
      // Borrow actions are not continued from Activity.
      resumable={false}
      completePath={
        getBorrowTransactionFlowDestination(flow.intake.entry).completePath
      }
      onCancel={() => leave(undefined)}
      onLeave={() => leave(undefined)}
      details={details}
      wallet={wallet}
    />
  );
};
