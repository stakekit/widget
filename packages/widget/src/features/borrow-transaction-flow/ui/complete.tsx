import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { useTranslation } from "react-i18next";
import {
  formatBorrowProviderName,
  formatNetworkName,
} from "../../../shared/lib/formatters";
import { formatAddress } from "../../../shared/lib/general";
import { formatTokenAmount } from "../../../shared/lib/number-format";
import { vars } from "../../../shared/styles/theme/contract.css";
import {
  DetailRow,
  DetailRowList,
} from "../../../shared/ui/components/details-section";
import { Box } from "../../../shared/ui/primitives/box";
import { CheckCircleIcon } from "../../../shared/ui/primitives/icons/check-circle";
import { ExternalLinkIcon } from "../../../shared/ui/primitives/icons/external-link";
import { Heading } from "../../../shared/ui/primitives/typography/heading";
import { Text } from "../../../shared/ui/primitives/typography/text";
import { useWidgetPresentation } from "../../../shared/ui/widget-presentation";
import { useTrackPage } from "../../tracking/index";
import {
  AnimationPage,
  PageContainer,
  PageCtaButton,
} from "../../widget-shell/views";
import { projectBorrowCompletion } from "../model/borrow-completion";
import {
  useBorrowTransactionFlow,
  useBorrowTransactionFlowExecution,
} from "../react/borrow-flow-route";
import { BorrowFlowPositionChangeRows } from "./position-change-rows";
import * as styles from "./styles.css";
import { BorrowFlowOriginationRows } from "./summary-rows";
import { useBorrowExecution } from "./use-borrow-execution";

export const BorrowCompletePage = () => {
  useTrackPage("borrowComplete");

  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();
  const flow = useBorrowTransactionFlow();
  const executionFlow = useBorrowTransactionFlowExecution();
  const settled = useAtomValue(executionFlow.settledPositionAtom);
  const execution = useBorrowExecution();
  const done = useAtomSet(executionFlow.leaveAtom);
  const result = execution.completionResult;
  const { summary } = flow.intake;
  const completion = projectBorrowCompletion({
    metadata: result?.action.metadata,
    settled,
    summary,
  });
  const { collateralFee, collateralSupplied, origination } = completion.details;
  const { headline, position } = completion;
  const { collateralUsd, debtUsd, healthFactor, ltv } = position.change;
  const hasPositionFigures = !!(
    collateralUsd ||
    debtUsd ||
    healthFactor ||
    ltv
  );
  const isPositionFlow = flow.intake.entry._tag === "MarketPosition";
  // A closed position redirects to the list, so the CTA names where it lands.
  const ctaLabel = (() => {
    if (!isPositionFlow) return t("dashboard.borrow.success_page.done");
    if (settled && !settled.positionOpen) {
      return t("dashboard.borrow.success_page.back_to_positions");
    }
    return t("dashboard.borrow.review_page.back_to_position");
  })();
  const [singleTransaction] = result?.transactions ?? [];

  if (!result) return null;

  return (
    <AnimationPage>
      <PageContainer>
        <Box
          data-rk="borrow-complete-page"
          display="flex"
          flexDirection="column"
          gap="5"
        >
          <Box
            alignItems="center"
            display="flex"
            flexDirection="column"
            gap="2"
            textAlign="center"
          >
            <Box className={styles.successBadge}>
              <CheckCircleIcon
                color={vars.color.statusSuccess}
                height={28}
                width={28}
              />
            </Box>
            <Text variant={{ weight: "bold" }}>
              {t(`dashboard.borrow.success_page.titles.${summary.action}`)}
            </Text>
            <Heading variant={{ level: "h3" }}>
              {headline.amount === null
                ? headline.symbol
                : `${formatTokenAmount(headline.amount, locale, "down")} ${headline.symbol}`}
            </Heading>
            <Text variant={{ type: "muted", weight: "normal" }}>
              {`${formatBorrowProviderName(summary.providerName)} · ${formatNetworkName(summary.network)}`}
            </Text>
          </Box>

          {collateralSupplied || collateralFee || origination ? (
            <DetailRowList>
              {collateralSupplied ? (
                <DetailRow
                  id="collateral-supplied"
                  label={t("dashboard.borrow.success_page.collateral_supplied")}
                  value={`${formatTokenAmount(collateralSupplied.amount, locale, "down")} ${collateralSupplied.symbol}`}
                />
              ) : null}
              {collateralFee ? (
                <DetailRow
                  id="collateral-fee"
                  label={t("dashboard.borrow.review_page.collateral_fee")}
                  value={`${formatTokenAmount(collateralFee.amount, locale, "up")} ${collateralFee.symbol}`}
                />
              ) : null}
              <BorrowFlowOriginationRows origination={origination} />
            </DetailRowList>
          ) : null}

          {hasPositionFigures ? (
            <Box display="flex" flexDirection="column" gap="1">
              <Text variant={{ size: "small", type: "muted" }}>
                {t(`dashboard.borrow.success_page.position.${position.source}`)}
              </Text>
              <DetailRowList>
                <BorrowFlowPositionChangeRows change={position.change} />
              </DetailRowList>
            </Box>
          ) : null}

          {result.transactions.length === 1 && singleTransaction ? (
            <Box
              as="button"
              className={styles.explorerLink}
              data-rk="borrow-complete-transaction-link"
              onClick={() =>
                window.open(singleTransaction.explorerUrl, "_blank")
              }
              type="button"
            >
              <Text variant={{ type: "muted", weight: "normal" }}>
                {t("dashboard.borrow.success_page.view_on_explorer")}
              </Text>
              <ExternalLinkIcon />
            </Box>
          ) : null}

          {result.transactions.length > 1 ? (
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
                      <CheckCircleIcon color={vars.color.statusSuccess} />
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
          ) : null}

          <PageCtaButton
            cta={{
              disabled: false,
              isLoading: false,
              label: ctaLabel,
              onClick: () => done(undefined),
            }}
          />
        </Box>
      </PageContainer>
    </AnimationPage>
  );
};
