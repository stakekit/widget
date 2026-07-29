import { useTranslation } from "react-i18next";
import {
  formatHealthFactor,
  formatPercent,
} from "../../../../../shared/lib/formatters";
import { formatNumber } from "../../../../../shared/lib/number-format";
import { Divider } from "../../../../../shared/ui/components/divider";
import { Box } from "../../../../../shared/ui/primitives/box";
import { Text } from "../../../../../shared/ui/primitives/typography/text";
import { DetailRow } from "../../../../earn/components";
import { PageCtaButton } from "../../../../widget-shell/components";
import type { BorrowCollateralToggleActionContext } from "../../../model/position-action-context";
import { resolveBorrowCollateralToggleFormView } from "../../../model/position-action-form";
import type { BorrowPositionAction } from "../../../model/position-details-model";
import { BorrowNotice } from "../../components/notices";
import * as styles from "../../styles.css";
import { useStartBorrowPositionReview } from "./use-start-review";

export const ToggleCollateralActionForm = ({
  action,
  context,
}: {
  readonly action: BorrowPositionAction;
  readonly context: BorrowCollateralToggleActionContext;
}) => {
  const { t } = useTranslation();
  const startReview = useStartBorrowPositionReview();
  const { position } = context;
  const isDisable = context.type === "disableCollateral";
  const tokenSymbol = context.supplyBalance.tokenSymbol;
  const currentRisk = position.risk.current;
  const healthFactor =
    currentRisk.status === "available" ? currentRisk.healthFactor : null;
  const currentLtv =
    currentRisk.status === "available" ? currentRisk.ltv : null;
  const view = resolveBorrowCollateralToggleFormView({
    address: action.reviewState.request.address,
    context,
  });

  const onContinue = () => {
    if (view.reviewState) {
      startReview(view.reviewState);
    }
  };

  return (
    <Box display="flex" flexDirection="column" gap="4">
      <Box className={styles.formCard}>
        <Text variant={{ weight: "bold" }}>
          {isDisable
            ? t("dashboard.borrow.position_details.disable_collateral_title", {
                symbol: tokenSymbol,
              })
            : t("dashboard.borrow.position_details.enable_collateral_title", {
                symbol: tokenSymbol,
              })}
        </Text>
        <Text variant={{ type: "muted", weight: "normal" }}>
          {isDisable
            ? t("dashboard.borrow.position_details.disable_collateral_warning")
            : t("dashboard.borrow.position_details.enable_collateral_warning")}
        </Text>

        <Divider />

        <DetailRow
          id="ltv"
          label={t("dashboard.borrow.form.ltv_ratio")}
          value={formatPercent(currentLtv)}
        />
        <DetailRow
          id="health"
          label={t("dashboard.borrow.position_details.health_factor")}
          value={formatHealthFactor(healthFactor)}
        />
        <DetailRow
          id="collateral"
          label={t("dashboard.borrow.position_details.collateral")}
          value={`${formatNumber(context.supplyBalance.balance, 6)} ${tokenSymbol}`}
        />
      </Box>

      {view.riskStatus === "unavailable" ? (
        <BorrowNotice title={t("dashboard.borrow.risk_unavailable.title")}>
          {t("dashboard.borrow.risk_unavailable.description")}
        </BorrowNotice>
      ) : null}

      <PageCtaButton
        cta={{
          disabled: !view.reviewState,
          isLoading: false,
          label: t("dashboard.borrow.review"),
          onClick: onContinue,
        }}
      />
    </Box>
  );
};
