import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { Box } from "../../../components/atoms/box";
import { Button } from "../../../components/atoms/button";
import { Heading } from "../../../components/atoms/typography/heading";
import { Text } from "../../../components/atoms/typography/text";
import type { ActionDto } from "../../../domain/types/action";
import type { TokenDto, YieldTokenDto } from "../../../domain/types/tokens";
import type { useProvidersDetails } from "../../../hooks/use-provider-details";
import { AnimationPage } from "../../../navigation/containers/animation-page";
import { useIsDashboard } from "../../../pages-dashboard/providers/dashboard-context";
import { useSettings } from "../../../providers/settings";
import { PageContainer } from "../../components/page-container";
import { useIsUnstakeOrPendingAction } from "../../position-details/state";
import { useSteps } from "../hooks/use-steps.hook";
import {
  stepsHeadingContainer,
  utilaPendingApprovalsBanner,
} from "./styles.css";
import { TxState } from "./tx-state";

type StepsPageProps = {
  session: ActionDto;
  inputToken?: TokenDto | YieldTokenDto;
  onSignSuccess?: () => void;
  providersDetails: ReturnType<typeof useProvidersDetails>;
};

export const StepsPage = ({
  session,
  inputToken,
  onSignSuccess,
  providersDetails,
}: StepsPageProps) => {
  const isUnstakeOrPendingAction = useIsUnstakeOrPendingAction();
  const isDashboard = useIsDashboard();
  const { variant } = useSettings();

  const { retry, txStates } = useSteps({
    inputToken,
    session,
    onSignSuccess,
    providersDetails,
  });

  const { t } = useTranslation();
  const showUtilaPendingApprovals = variant === "utila";

  return (
    <AnimationPage>
      <motion.div layout="position">
        <PageContainer position="relative">
          <Box
            marginBottom="2"
            className={stepsHeadingContainer({
              variant:
                isDashboard && isUnstakeOrPendingAction
                  ? "absolute"
                  : "default",
            })}
          >
            <Heading variant={{ level: "h4" }}>{t("steps.title")}</Heading>
          </Box>

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
                  session={session}
                />
              ))}
            </Box>
          </Box>

          {retry && (
            <Box my="4">
              <Button data-rk="footer-button-primary" onClick={retry}>
                {t("shared.retry")}
              </Button>
            </Box>
          )}
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
