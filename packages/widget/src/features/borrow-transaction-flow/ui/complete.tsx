import { useAtomSet } from "@effect/atom-react";
import { useTranslation } from "react-i18next";
import {
  formatBorrowProviderName,
  formatNetworkName,
} from "../../../shared/lib/formatters";
import { DetailRow } from "../../../shared/ui/components/details-section";
import { Box } from "../../../shared/ui/primitives/box";
import { Button } from "../../../shared/ui/primitives/button";
import { CheckCircleIcon } from "../../../shared/ui/primitives/icons/check-circle";
import { Text } from "../../../shared/ui/primitives/typography/text";
import { useTrackPage } from "../../tracking/index";
import {
  AnimationPage,
  PageContainer,
  PageCtaButton,
} from "../../widget-shell/views";
import {
  getBorrowTransactionFlowAmountLabelKey,
  projectBorrowTransactionFlowSummary,
} from "../model/borrow-transaction-flow";
import {
  useBorrowTransactionFlow,
  useBorrowTransactionFlowExecution,
} from "../react/borrow-flow-route";
import { useBorrowExecution } from "./use-borrow-execution";

export const BorrowCompletePage = () => {
  useTrackPage("borrowComplete");

  const { t } = useTranslation();
  const flow = useBorrowTransactionFlow();
  const execution = useBorrowExecution();
  const executionFlow = useBorrowTransactionFlowExecution();
  const done = useAtomSet(executionFlow.finishAtom);
  const result = execution.completionResult;
  const { summary } = flow.intake;
  const projectedSummary = projectBorrowTransactionFlowSummary(summary);
  const isPositionFlow = flow.intake.entry._tag === "MarketPosition";

  if (!result) return null;

  const rows = [
    projectedSummary.borrow
      ? {
          id: "borrow-amount",
          label: t(getBorrowTransactionFlowAmountLabelKey(summary.action)),
          value: `${projectedSummary.borrow.amount} ${projectedSummary.borrow.symbol}`,
        }
      : null,
    projectedSummary.collateral
      ? {
          id: "collateral-amount",
          label: t("dashboard.borrow.review_page.collateral_amount"),
          value: `${projectedSummary.collateral.amount} ${projectedSummary.collateral.symbol}`,
        }
      : null,
    {
      id: "market",
      label: t("dashboard.borrow.review_page.market"),
      value: summary.marketLabel,
    },
    {
      id: "provider",
      label: t("dashboard.borrow.review_page.provider"),
      value: formatBorrowProviderName(summary.providerName),
    },
    {
      id: "network",
      label: t("dashboard.borrow.review_page.network"),
      value: formatNetworkName(summary.network),
    },
  ].filter((row): row is NonNullable<typeof row> => !!row);

  return (
    <AnimationPage>
      <PageContainer>
        <Box
          data-rk="borrow-complete-page"
          display="flex"
          flex={1}
          flexDirection="column"
          gap="5"
          justifyContent="center"
          textAlign="center"
        >
          <Box alignItems="center" display="flex" justifyContent="center">
            <CheckCircleIcon height={40} width={40} />
          </Box>

          <Box display="flex" flexDirection="column" gap="2">
            {isPositionFlow ? (
              <Box display="flex" justifyContent="center">
                <Button
                  onClick={() => done(undefined)}
                  variant={{ color: "secondary", size: "small" }}
                >
                  {t("dashboard.borrow.review_page.back_to_position")}
                </Button>
              </Box>
            ) : null}

            <Text variant={{ weight: "bold" }}>
              {t("dashboard.borrow.success_page.title")}
            </Text>
            <Text variant={{ type: "muted", weight: "normal" }}>
              {t(`dashboard.borrow.review_page.actions.${summary.action}`)}
            </Text>
          </Box>

          <Box display="flex" flexDirection="column" gap="1" textAlign="left">
            {rows.map((row) => (
              <DetailRow key={row.id} {...row} />
            ))}
          </Box>

          {result.submissions.length > 0 && (
            <Box display="flex" flexDirection="column" gap="2">
              {result.submissions.map((submission) =>
                submission.link ? (
                  <Box
                    as="button"
                    data-rk="borrow-complete-transaction-link"
                    display="flex"
                    justifyContent="center"
                    key={`${submission.batchId}-${submission.transactionId}`}
                    onClick={() =>
                      window.open(submission.link ?? undefined, "_blank")
                    }
                  >
                    <Text variant={{ type: "muted" }}>
                      {t("dashboard.borrow.success_page.view_transaction")}
                    </Text>
                  </Box>
                ) : null
              )}
            </Box>
          )}

          <PageCtaButton
            cta={{
              disabled: false,
              isLoading: false,
              label: t("dashboard.borrow.success_page.done"),
              onClick: () => done(undefined),
            }}
          />
        </Box>
      </PageContainer>
    </AnimationPage>
  );
};
