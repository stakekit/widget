import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { useTranslation } from "react-i18next";
import {
  formatBorrowProviderName,
  formatNetworkName,
} from "../../../shared/lib/formatters";
import { formatAddress } from "../../../shared/lib/general";
import { formatTokenAmount } from "../../../shared/lib/number-format";
import { useWidgetPresentation } from "../../../shared/react/widget-presentation";
import {
  Card,
  DetailList,
  DetailRow,
  ExternalLink,
  Icon,
  Stack,
  Text,
  VisuallyHidden,
} from "../../../ui/index";
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
        <Stack hostHook="borrow-complete-page" gap={20}>
          <Stack align="center" gap={8}>
            <Icon name="CheckCircleIcon" size="lg" tone="success" />
            <Text weight="semibold">
              {t(`dashboard.borrow.success_page.titles.${summary.action}`)}
            </Text>
            <Text variant="title" as="h2" numeric>
              {headline.amount === null
                ? headline.symbol
                : `${formatTokenAmount(headline.amount, locale, "down")} ${headline.symbol}`}
            </Text>
            <Text tone="muted">
              {`${formatBorrowProviderName(summary.providerName)} · ${formatNetworkName(summary.network)}`}
            </Text>
          </Stack>

          {collateralSupplied || collateralFee || origination ? (
            <DetailList>
              {collateralSupplied ? (
                <DetailRow
                  label={t("dashboard.borrow.success_page.collateral_supplied")}
                  value={`${formatTokenAmount(collateralSupplied.amount, locale, "down")} ${collateralSupplied.symbol}`}
                />
              ) : null}
              {collateralFee ? (
                <DetailRow
                  label={t("dashboard.borrow.review_page.collateral_fee")}
                  value={`${formatTokenAmount(collateralFee.amount, locale, "up")} ${collateralFee.symbol}`}
                />
              ) : null}
              <BorrowFlowOriginationRows origination={origination} />
            </DetailList>
          ) : null}

          {hasPositionFigures ? (
            <Stack gap={8}>
              <Text variant="overline" tone="muted">
                {t(`dashboard.borrow.success_page.position.${position.source}`)}
              </Text>
              <DetailList>
                <BorrowFlowPositionChangeRows change={position.change} />
              </DetailList>
            </Stack>
          ) : null}

          {result.transactions.length === 1 && singleTransaction ? (
            <Stack align="center">
              <ExternalLink
                href={singleTransaction.explorerUrl}
                newTabLabel={t("shared.opens_in_new_tab")}
              >
                {t("dashboard.borrow.success_page.view_on_explorer")}
              </ExternalLink>
            </Stack>
          ) : null}

          {result.transactions.length > 1 ? (
            <Card padding={16}>
              <Stack gap={12}>
                <Text variant="overline" tone="muted">
                  {t("dashboard.borrow.success_page.transactions")}
                </Text>
                {result.transactions.map((transaction) => {
                  const type = t(
                    `dashboard.borrow.execution_page.tx_type.${transaction.type}`
                  );
                  const viewLabel = t(
                    "dashboard.borrow.success_page.view_transaction",
                    { type }
                  );

                  return (
                    <Stack
                      key={transaction.id}
                      direction="row"
                      align="center"
                      justify="between"
                      gap={12}
                    >
                      <Stack direction="row" align="center" gap={8}>
                        <Icon name="CheckCircleIcon" size="sm" tone="success" />
                        <Text>{type}</Text>
                      </Stack>
                      <Text variant="caption" numeric>
                        <ExternalLink
                          href={transaction.explorerUrl}
                          newTabLabel={t("shared.opens_in_new_tab")}
                        >
                          {transaction.hash ? (
                            <>
                              <VisuallyHidden>{`${viewLabel}, `}</VisuallyHidden>
                              {formatAddress(transaction.hash, {
                                leadingChars: 6,
                                trailingChars: 4,
                              })}
                            </>
                          ) : (
                            viewLabel
                          )}
                        </ExternalLink>
                      </Text>
                    </Stack>
                  );
                })}
              </Stack>
            </Card>
          ) : null}

          <PageCtaButton
            cta={{
              disabled: false,
              isLoading: false,
              label: ctaLabel,
              onClick: () => done(undefined),
            }}
          />
        </Stack>
      </PageContainer>
    </AnimationPage>
  );
};
