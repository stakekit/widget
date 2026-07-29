import { useTranslation } from "react-i18next";
import { formatPercent } from "../../../../../shared/lib/formatters";
import { formatNumber } from "../../../../../shared/lib/number-format";
import { Divider } from "../../../../../shared/ui/components/divider";
import { Box } from "../../../../../shared/ui/primitives/box";
import { Text } from "../../../../../shared/ui/primitives/typography/text";
import { DetailRow } from "../../../../earn/components";
import { PageCtaButton } from "../../../../widget-shell/components";
import type { BorrowRepayActionContext } from "../../../model/position-action-context";
import type { BorrowPositionAction } from "../../../model/position-details-model";
import { useBorrowRepayForm } from "../../../react/use-borrow-position-action-form";
import { BorrowNotice } from "../../components/notices";
import * as styles from "../../styles.css";
import { AmountInputCard } from "./amount-input-card";
import { getBorrowPositionFormErrorMessage } from "./form-error";
import { useStartBorrowPositionReview } from "./use-start-review";

export const RepayActionForm = ({
  action,
  context,
}: {
  readonly action: BorrowPositionAction;
  readonly context: BorrowRepayActionContext;
}) => {
  const { t } = useTranslation();
  const startReview = useStartBorrowPositionReview();
  const [view, dispatch] = useBorrowRepayForm({ action, context });
  const { debtBalance } = context;
  const error = getBorrowPositionFormErrorMessage({ error: view.error, t });

  const onContinue = () => {
    if (view.reviewState) {
      startReview(view.reviewState);
    }
  };

  return (
    <Box display="flex" flexDirection="column" gap="4">
      <AmountInputCard
        amount={view.amount}
        balanceLabel={t("dashboard.borrow.position_details.outstanding_debt", {
          amount: formatNumber(debtBalance.balance, 6),
          symbol: debtBalance.tokenSymbol,
        })}
        disabled={view.repayAll}
        error={error}
        label={t("dashboard.borrow.position_details.actions.repay")}
        onAmountChange={(amount) => dispatch({ amount, type: "amount/set" })}
        tokenSymbol={debtBalance.tokenSymbol}
        usdValue={view.repayUsd}
      />

      {view.riskStatus === "unavailable" &&
      (view.repayAll || view.amount.gt(0)) ? (
        <BorrowNotice title={t("dashboard.borrow.risk_unavailable.title")}>
          {t("dashboard.borrow.risk_unavailable.description")}
        </BorrowNotice>
      ) : null}

      <Box className={styles.formCard}>
        <Box className={styles.checkboxRow}>
          <Box display="flex" flexDirection="column" gap="1">
            <Text variant={{ weight: "bold" }}>
              {t("dashboard.borrow.position_details.repay_full")}
            </Text>
            <Text variant={{ type: "muted", weight: "normal" }}>
              {t("dashboard.borrow.position_details.repay_full_description")}
            </Text>
          </Box>
          <input
            checked={view.repayAll}
            className={styles.checkbox}
            onChange={(event) =>
              dispatch({
                repayAll: event.target.checked,
                type: "repayAll/set",
              })
            }
            type="checkbox"
          />
        </Box>

        <Divider />

        <DetailRow
          id="ltv"
          label={t("dashboard.borrow.form.ltv_ratio")}
          value={`${formatPercent(view.currentLtv)} -> ${formatPercent(
            view.projectedLtv
          )}`}
        />
        <DetailRow
          id="loan"
          label={t("dashboard.borrow.form.loan")}
          value={`${formatNumber(debtBalance.balance, 6)} -> ${formatNumber(
            view.remainingDebt,
            6
          )} ${debtBalance.tokenSymbol}`}
        />
      </Box>

      <PageCtaButton
        cta={{
          disabled: !view.canSubmit,
          isLoading: false,
          label: t("dashboard.borrow.review"),
          onClick: onContinue,
        }}
      />
    </Box>
  );
};
