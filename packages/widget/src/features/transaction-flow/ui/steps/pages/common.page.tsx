import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { useWidgetConfig } from "../../../../../app/config";
import { Box } from "../../../../../shared/ui/primitives/box";
import { Button } from "../../../../../shared/ui/primitives/button";
import { Heading } from "../../../../../shared/ui/primitives/typography/heading";
import { Text } from "../../../../../shared/ui/primitives/typography/text";
import {
  AnimationPage,
  PageContainer,
  PageCtaButton,
} from "../../../../widget-shell";
import { useSteps } from "../hooks/use-steps.hook";
import { stepsErrorBanner, utilaPendingApprovalsBanner } from "./styles.css";
import { TxState } from "./tx-state";

export const StepsPage = () => {
  const dashboardVariant = useWidgetConfig("dashboardVariant");
  const variant = useWidgetConfig("variant");

  const { retry, txStates, cta, customSignErrorMessage, yieldId } = useSteps();

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
            <Box
              background="backgroundMuted"
              flexDirection="column"
              display="flex"
              px="4"
              py="4"
              borderRadius="xl"
              flex={1}
            >
              {txStates.map((txState, i) => (
                <TxState
                  key={i}
                  txState={txState}
                  position={getPosition(txStates.length, i)}
                  count={{ current: i + 1, total: txStates.length }}
                  yieldId={yieldId}
                />
              ))}
            </Box>
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

const getPosition = (txStatesLength: number, currentIdx: number) =>
  txStatesLength === 1
    ? "SINGLE"
    : currentIdx === 0
      ? "FIRST"
      : currentIdx === txStatesLength - 1
        ? "LAST"
        : "ELSE";
