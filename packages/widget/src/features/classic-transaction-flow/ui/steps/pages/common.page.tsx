import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { isEthenaUsdeStaking } from "../../../../../domain/earn/yield";
import { useWidgetConfig } from "../../../../../features/widget-configuration/index";
import { TransactionSteps } from "../../../../../shared/ui/components/transaction-steps";
import { Box } from "../../../../../shared/ui/primitives/box";
import { Button } from "../../../../../shared/ui/primitives/button";
import { Heading } from "../../../../../shared/ui/primitives/typography/heading";
import { Text } from "../../../../../shared/ui/primitives/typography/text";
import {
  AnimationPage,
  PageContainer,
  PageCtaButton,
} from "../../../../widget-shell/views";
import { formatTransactionTypeLabel } from "../../../model/classic-transaction-workflow";
import { useSteps } from "../hooks/use-steps.hook";
import { stepsErrorBanner, utilaPendingApprovalsBanner } from "./styles.css";

export const StepsPage = () => {
  const dashboardVariant = useWidgetConfig("dashboardVariant");
  const variant = useWidgetConfig("variant");

  const { cancelled, retry, txStates, cta, customSignErrorMessage, yieldId } =
    useSteps();

  const { t } = useTranslation();
  const showUtilaPendingApprovals = variant === "utila";

  return (
    <AnimationPage>
      <motion.div layout="position">
        <PageContainer position="relative">
          <Box marginBottom="2">
            <Heading variant={{ level: "h4" }}>{t("steps.title")}</Heading>
          </Box>

          {customSignErrorMessage && (
            <Box
              className={stepsErrorBanner}
              data-rk="steps-custom-sign-error"
              px="4"
              py="3"
            >
              <Text variant={{ weight: "normal", type: "inverted" }}>
                {customSignErrorMessage}
              </Text>
            </Box>
          )}

          {cancelled && (
            <Box data-rk="steps-cancelled" marginBottom="2">
              <Text variant={{ type: "muted", weight: "normal" }}>
                {t("steps.cancelled")}
              </Text>
            </Box>
          )}

          {showUtilaPendingApprovals && (
            <Box
              className={utilaPendingApprovalsBanner}
              data-rk="utila-pending-approvals"
              px="4"
              py="3"
            >
              <Text variant={{ weight: "bold" }}>
                {t("steps.pending_approvals")}
              </Text>
              <Text variant={{ weight: "normal" }}>
                {t("steps.pending_approvals_desc")}
              </Text>
            </Box>
          )}

          <Box flex={1} display="flex">
            <TransactionSteps
              steps={txStates.map((txState) => ({
                done: txState.meta.done,
                id: txState.tx.id,
                state: txState.state,
                type: formatTransactionTypeLabel(txState.tx.type, t, {
                  context: isEthenaUsdeStaking(yieldId)
                    ? "ETHENA_USDE"
                    : undefined,
                }),
              }))}
            />
          </Box>

          {retry && (
            <Box my="4">
              <Button
                data-rk="footer-button-primary"
                onClick={retry}
                variant={{ size: dashboardVariant ? "compact" : "regular" }}
              >
                {t("shared.retry")}
              </Button>
            </Box>
          )}

          <PageCtaButton cta={cta} />
        </PageContainer>
      </motion.div>
    </AnimationPage>
  );
};
