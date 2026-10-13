import { useAtomSet } from "@effect/atom-react";
import { useTranslation } from "react-i18next";
import { formatAddress } from "../../../shared/lib/general";
import { Box } from "../../../shared/ui/primitives/box";
import { Button } from "../../../shared/ui/primitives/button";
import { CheckCircleIcon } from "../../../shared/ui/primitives/icons/check-circle";
import { ExternalLinkIcon } from "../../../shared/ui/primitives/icons/external-link";
import { Text } from "../../../shared/ui/primitives/typography/text";
import { useTrackPage } from "../../tracking/index";
import {
  AnimationPage,
  PageContainer,
  PageCtaButton,
} from "../../widget-shell/views";
import { projectBorrowTransactionFlowSummary } from "../model/borrow-transaction-flow";
import {
  useBorrowTransactionFlow,
  useBorrowTransactionFlowExecution,
} from "../react/borrow-flow-route";
import * as styles from "./styles.css";
import {
  BorrowFlowAmountRows,
  BorrowFlowMarketRows,
  BorrowFlowOriginationRows,
} from "./summary-rows";
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
  const projectedSummary = projectBorrowTransactionFlowSummary(
    summary,
    result?.action.metadata
  );
  const isPositionFlow = flow.intake.entry._tag === "MarketPosition";

  if (!result) return null;

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
              {t(`dashboard.borrow.success_page.titles.${summary.action}`)}
            </Text>
            <Text variant={{ type: "muted", weight: "normal" }}>
              {t(`dashboard.borrow.review_page.actions.${summary.action}`)}
            </Text>
          </Box>

          <Box display="flex" flexDirection="column" gap="1" textAlign="left">
            <BorrowFlowAmountRows
              action={summary.action}
              projected={projectedSummary}
            />
            <BorrowFlowOriginationRows
              origination={projectedSummary.origination}
            />
            <BorrowFlowMarketRows summary={summary} />
          </Box>

          {result.transactions.length > 0 && (
            <Box className={styles.transactionList} textAlign="left">
              <Text variant={{ size: "small", type: "muted" }}>
                {t("dashboard.borrow.success_page.transactions")}
              </Text>
              {result.transactions.map((transaction) => {
                const type = t(
                  `dashboard.borrow.execution_page.tx_type.${transaction.type}`
                );

                return (
                  <Box
                    aria-label={t(
                      "dashboard.borrow.success_page.view_transaction",
                      { type }
                    )}
                    as="button"
                    className={styles.transactionRow}
                    data-rk="borrow-complete-transaction-link"
                    key={transaction.id}
                    onClick={() =>
                      window.open(transaction.explorerUrl, "_blank")
                    }
                    type="button"
                  >
                    <Box alignItems="center" display="flex" gap="2">
                      <CheckCircleIcon />
                      <Text>{type}</Text>
                    </Box>
                    <Box alignItems="center" display="flex" gap="1">
                      {transaction.hash ? (
                        <Text variant={{ type: "muted", weight: "normal" }}>
                          {formatAddress(transaction.hash, {
                            leadingChars: 6,
                            trailingChars: 4,
                          })}
                        </Text>
                      ) : null}
                      <ExternalLinkIcon />
                    </Box>
                  </Box>
                );
              })}
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
