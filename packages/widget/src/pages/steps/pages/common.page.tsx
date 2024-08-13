import type { ActionDto } from "@stakekit/api-hooks";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Box, Button, Heading } from "../../../components";
import { AnimationPage } from "../../../navigation/containers/animation-page";
import { PageContainer } from "../../components";
import { useSteps } from "../hooks/use-steps.hook";
import { TxState } from "./tx-state";

type StepsPageProps = {
  session: ActionDto;
  onSignSuccess?: () => void;
};

export const StepsPage = ({ session, onSignSuccess }: StepsPageProps) => {
  const { retry, txStates } = useSteps({
    session,
    onSignSuccess,
  });

  const { t } = useTranslation();

  return (
    <AnimationPage>
      <motion.div layout="position">
        <PageContainer>
          <Box marginBottom="2">
            <Heading variant={{ level: "h4" }}>{t("steps.title")}</Heading>
          </Box>

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
