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
import { resolveBorrowCollateralToggleReviewState } from "../../../model/position-action-form";
import type { BorrowPositionAction } from "../../../model/position-details-model";
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
  const healthFactor = position.getHealthFactor();

  const onContinue = () =>
    startReview(
      resolveBorrowCollateralToggleReviewState({
        address: action.reviewState.request.address,
        context,
      })
    );

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
          value={formatPercent(position.getCurrentLtv())}
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

      <PageCtaButton
        cta={{
          disabled: false,
          isLoading: false,
          label: t("dashboard.borrow.review"),
          onClick: onContinue,
        }}
      />
    </Box>
  );
};
