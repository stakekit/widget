import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { useTranslation } from "react-i18next";
import {
  formatBorrowProviderName,
  formatNetworkName,
} from "../../../shared/lib/formatters";
import { formatTransactionHash } from "../../../shared/lib/general";
import {
  formatTokenAmount,
  formatUsd,
} from "../../../shared/lib/number-format";
import { useTokenLogoResolver } from "../../../shared/react/token-logo";
import { useWidgetPresentation } from "../../../shared/react/widget-presentation";
import { CompleteSummary, Stack } from "../../../ui/index";
import { useTrackPage } from "../../tracking/index";
import {
  AnimationPage,
  PageContainer,
  type PageCta,
  PageCtaButton,
} from "../../widget-shell/views";
import {
  getBorrowCompletionLogos,
  projectBorrowCompletion,
} from "../model/borrow-completion";
import { getBorrowTransactionFlowAmountLabelKey } from "../model/borrow-transaction-flow";
import {
  useBorrowTransactionFlow,
  useBorrowTransactionFlowExecution,
} from "../react/borrow-flow-route";
import {
  getBorrowFlowOriginationRows,
  getBorrowFlowPositionChangeRows,
} from "./summary-rows";
import { useBorrowExecution } from "./use-borrow-execution";

const action = (label: string, onClick: () => void): NonNullable<PageCta> => ({
  disabled: false,
  isLoading: false,
  label,
  onClick,
});

export const BorrowCompletePage = () => {
  useTrackPage("borrowComplete");

  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();
  const resolveTokenLogo = useTokenLogoResolver();
  const flow = useBorrowTransactionFlow();
  const executionFlow = useBorrowTransactionFlowExecution();
  const settled = useAtomValue(executionFlow.settledPositionAtom);
  const execution = useBorrowExecution();
  const finish = useAtomSet(executionFlow.finishAtom);
  const viewPosition = useAtomSet(executionFlow.viewPositionAtom);
  const result = execution.completionResult;
  const { summary } = flow.intake;
  const completion = projectBorrowCompletion({
    metadata: result?.action.metadata,
    settled,
    summary,
  });
  const { collateralFee, collateralSupplied, origination } = completion.details;
  const { headline, position } = completion;
  const isPositionFlow = flow.intake.entry._tag === "MarketPosition";
  const logos = getBorrowCompletionLogos(summary, flow.intake.entry);
  const tokenLogo = logos.token
    ? resolveTokenLogo(logos.token, { badge: "none" })
    : null;

  if (!result) return null;

  // Complete leads back to the position only once the Borrow API reports it
  // open; while the refresh is unsettled the action may have closed it.
  const positionOpen = settled?.positionOpen === true;
  const positionClosed = settled?.positionOpen === false;
  const done = action(
    isPositionFlow && positionClosed
      ? t("dashboard.borrow.success_page.back_to_positions")
      : t("dashboard.borrow.success_page.done"),
    () => finish(undefined)
  );
  const originationRows = getBorrowFlowOriginationRows({
    locale,
    origination,
    t,
  });
  // Debt actions are about the loan; the others about the collateral.
  const headlineIsLoan =
    summary.action === "borrow" ||
    summary.action === "borrowAndSupply" ||
    summary.action === "repay";
  const amountLabel = headlineIsLoan
    ? t(getBorrowTransactionFlowAmountLabelKey(summary.action))
    : t("dashboard.borrow.review_page.collateral_amount");

  return (
    <AnimationPage>
      <PageContainer>
        <Stack hostHook="borrow-complete-page" gap={20}>
          <CompleteSummary
            mark={{
              name: tokenLogo?.name ?? headline.symbol,
              tokenSrc: tokenLogo?.src,
              providerSrc: logos.providerSrc ?? undefined,
            }}
            title={t(`dashboard.borrow.success_page.titles.${summary.action}`, {
              symbol: headline.symbol,
            })}
            detail={`${formatBorrowProviderName(summary.providerName)} · ${formatNetworkName(summary.network)}`}
            rows={[
              ...(headline.amount === null
                ? []
                : [
                    {
                      label: amountLabel,
                      testId: "borrow-complete-amount",
                      value: `${formatTokenAmount(headline.amount, locale, "down")} ${headline.symbol}`,
                      ...(headline.usd
                        ? { caption: formatUsd(headline.usd, locale) }
                        : {}),
                    },
                  ]),
              ...(collateralSupplied
                ? [
                    {
                      label: t(
                        "dashboard.borrow.success_page.collateral_supplied"
                      ),
                      value: `${formatTokenAmount(collateralSupplied.amount, locale, "down")} ${collateralSupplied.symbol}`,
                    },
                  ]
                : []),
              ...(collateralFee
                ? [
                    {
                      label: t("dashboard.borrow.review_page.collateral_fee"),
                      value: `${formatTokenAmount(collateralFee.amount, locale, "up")} ${collateralFee.symbol}`,
                    },
                  ]
                : []),
              ...(originationRows
                ? [originationRows.fee, originationRows.principal]
                : []),
            ]}
            sections={[
              {
                heading: t(
                  `dashboard.borrow.success_page.position.${position.source}`
                ),
                rows: getBorrowFlowPositionChangeRows({
                  change: position.change,
                  locale,
                  t,
                }),
              },
            ]}
            transactions={{
              heading: t("dashboard.borrow.success_page.transactions"),
              items: result.transactions.map((transaction) => {
                const type = t(
                  `dashboard.borrow.execution_page.tx_type.${transaction.type}`
                );
                return {
                  id: transaction.id,
                  label: type,
                  href: transaction.explorerUrl,
                  viewLabel: t(
                    "dashboard.borrow.success_page.view_transaction",
                    { type }
                  ),
                  ...(transaction.hash
                    ? { hash: formatTransactionHash(transaction.hash) }
                    : {}),
                };
              }),
              newTabLabel: t("shared.opens_in_new_tab"),
            }}
          />
        </Stack>

        <PageCtaButton
          cta={
            positionOpen
              ? action(t("complete.view_position"), () =>
                  viewPosition(undefined)
                )
              : done
          }
          secondary={positionOpen ? { ...done, variant: "secondary" } : null}
        />
      </PageContainer>
    </AnimationPage>
  );
};
