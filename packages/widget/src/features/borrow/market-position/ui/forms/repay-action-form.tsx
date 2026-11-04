import { useTranslation } from "react-i18next";
import { formatTokenAmount } from "../../../../../shared/lib/number-format";
import { useWidgetPresentation } from "../../../../../shared/react/widget-presentation";
import {
  Card,
  Checkbox,
  DetailList,
  DetailRow,
  Divider,
  Stack,
  Text,
} from "../../../../../ui/index";
import { PageCtaButton } from "../../../../widget-shell/views";
import type { BorrowRepayActionContext } from "../../../action-preparation/index";
import type { BorrowPositionAction } from "../../model/details";
import { useBorrowRepayForm } from "../../react/use-action-form";
import { AmountInputCard } from "./amount-input-card";
import { getBorrowPositionFormWarningMessage } from "./form-warning";
import { LtvTransitionRow } from "./ltv-transition-row";
import { useStartBorrowPositionReview } from "./use-start-review";

export const RepayActionForm = ({
  action,
  context,
}: {
  readonly action: BorrowPositionAction;
  readonly context: BorrowRepayActionContext;
}) => {
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();
  const startReview = useStartBorrowPositionReview(action);
  const [view, dispatch] = useBorrowRepayForm(action);
  const { debtBalance } = context;

  if (!view) {
    return null;
  }

  const warning = getBorrowPositionFormWarningMessage({
    warning: view.warning,
    t,
  });

  return (
    <Stack gap={16}>
      <AmountInputCard
        amount={view.amount}
        balanceLabel={t("dashboard.borrow.position_details.outstanding_debt", {
          amount: formatTokenAmount(debtBalance.balance, locale, "up"),
          symbol: debtBalance.tokenSymbol,
        })}
        disabled={view.repayAll}
        label={t("dashboard.borrow.position_details.actions.repay")}
        onAmountChange={(amount) => dispatch({ amount, type: "amount/set" })}
        tokenSymbol={debtBalance.tokenSymbol}
        usdValue={view.repayUsd}
        warning={warning}
      />

      <Card padding={16}>
        <Stack gap={12}>
          <Checkbox
            checked={view.repayAll}
            onCheckedChange={(repayAll) =>
              dispatch({ repayAll, type: "repayAll/set" })
            }
            label={
              <Stack as="span" gap={2}>
                <Text weight="semibold">
                  {t("dashboard.borrow.position_details.repay_full")}
                </Text>
                <Text variant="caption" tone="muted">
                  {t(
                    "dashboard.borrow.position_details.repay_full_description"
                  )}
                </Text>
              </Stack>
            }
          />

          <Divider />

          <DetailList>
            <LtvTransitionRow
              currentLtv={view.currentLtv}
              projectedLtv={view.projectedLtv}
            />
            <DetailRow
              label={t("dashboard.borrow.form.loan")}
              value={`${formatTokenAmount(debtBalance.balance, locale, "up")} -> ${formatTokenAmount(
                view.remainingDebt,
                locale,
                "up"
              )} ${debtBalance.tokenSymbol}`}
            />
          </DetailList>
        </Stack>
      </Card>

      <PageCtaButton
        cta={{
          disabled: !view.canSubmit,
          isLoading: false,
          label: t("dashboard.borrow.review_actions.repay"),
          onClick: startReview,
        }}
      />
    </Stack>
  );
};
