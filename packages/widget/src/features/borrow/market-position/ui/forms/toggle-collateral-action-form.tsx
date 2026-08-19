import { useTranslation } from "react-i18next";
import {
  formatHealthFactor,
  formatPercent,
} from "../../../../../shared/lib/formatters";
import { formatNumber } from "../../../../../shared/lib/number-format";
import { DetailRow } from "../../../../../shared/ui/components/details-section";
import { Divider } from "../../../../../shared/ui/components/divider";
import { Box } from "../../../../../shared/ui/primitives/box";
import { Text } from "../../../../../shared/ui/primitives/typography/text";
import { PageCtaButton } from "../../../../widget-shell/views";
import { BorrowNotice } from "../../../action-feedback/views";
import type { BorrowCollateralToggleActionContext } from "../../../action-preparation/index";
import type { BorrowPositionAction } from "../../model/details";
import { useBorrowCollateralToggleForm } from "../../react/use-action-form";
import * as styles from "../styles.css";
import { useStartBorrowPositionReview } from "./use-start-review";

export const ToggleCollateralActionForm = ({
  action,
  context,
}: {
  readonly action: BorrowPositionAction;
  readonly context: BorrowCollateralToggleActionContext;
}) => {
  const { t } = useTranslation();
  const startReview = useStartBorrowPositionReview(action);
  const { position } = context;
  const isDisable = context.type === "disableCollateral";
  const tokenSymbol = context.supplyBalance.tokenSymbol;
  const currentRisk = position.risk.current;
  const healthFactor =
    currentRisk.status === "available" ? currentRisk.healthFactor : null;
  const currentLtv =
    currentRisk.status === "available" ? currentRisk.ltv : null;
  const view = useBorrowCollateralToggleForm(action);

  if (!view) {
    return null;
  }

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
          disabled: view.preparation._tag !== "Ready",
          isLoading: false,
          label: t("dashboard.borrow.review"),
          onClick: startReview,
        }}
      />
    </Box>
  );
};
