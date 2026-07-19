import { useAtomSet } from "@effect/atom-react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router";
import { Box } from "../../../shared/ui/primitives/box";
import { Button } from "../../../shared/ui/primitives/button";
import { CheckCircleIcon } from "../../../shared/ui/primitives/icons/check-circle";
import { Text } from "../../../shared/ui/primitives/typography/text";
import { DetailRow } from "../../earn/ui/dashboard/earn-details/components/details-section";
import { useTrackPage } from "../../tracking/react/use-track-page";
import { AnimationPage } from "../../widget-shell/animation-page";
import { PageContainer } from "../../widget-shell/page-container";
import { PageCtaButton } from "../../widget-shell/page-cta";
import { borrowActionFormAtom } from "../atoms/action-form";
import { currentBorrowDashboardAtom } from "../atoms/form";
import { useBorrowCompletionRouteState } from "./borrow-execution-route";
import { getBorrowFlowRoutes } from "./flow-routes";
import { useBorrowConnectedWalletBridge } from "./wallet-bridge";

export const BorrowCompletePage = () => {
  useTrackPage("borrowComplete");

  const { t } = useTranslation();
  const navigate = useNavigate();
  const { marketId } = useParams();
  const { basePath } = getBorrowFlowRoutes(marketId);
  useBorrowConnectedWalletBridge();
  const resetActionForm = useAtomSet(borrowActionFormAtom);
  const resetBorrowDashboard = useAtomSet(currentBorrowDashboardAtom);
  const { input, result } = useBorrowCompletionRouteState();
  const { summary } = input;
  const onDone = () => {
    resetActionForm({ type: "reset" });
    resetBorrowDashboard({ type: "reset" });
    navigate(basePath, { replace: true });
  };

  const rows = [
    summary.borrowAmount && summary.loanTokenSymbol
      ? {
          id: "borrow-amount",
          label: t("dashboard.borrow.review_page.borrow_amount"),
          value: `${summary.borrowAmount} ${summary.loanTokenSymbol}`,
        }
      : null,
    summary.collateralAmount && summary.collateralTokenSymbol
      ? {
          id: "collateral-amount",
          label: t("dashboard.borrow.review_page.collateral_amount"),
          value: `${summary.collateralAmount} ${summary.collateralTokenSymbol}`,
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
      value: summary.providerName,
    },
    {
      id: "network",
      label: t("dashboard.borrow.review_page.network"),
      value: summary.network,
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
            {marketId ? (
              <Box display="flex" justifyContent="center">
                <Button
                  onClick={() => navigate(basePath)}
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
              onClick: onDone,
            }}
          />
        </Box>
      </PageContainer>
    </AnimationPage>
  );
};
