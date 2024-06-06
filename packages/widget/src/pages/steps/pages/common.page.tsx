import type { ActionDto } from "@stakekit/api-hooks";
import { motion } from "framer-motion";
import type { Maybe } from "purify-ts";
import { useTranslation } from "react-i18next";
import { Box, Button, Heading } from "../../../components";
import { AnimationPage } from "../../../navigation/containers/animation-page";
import { PageContainer } from "../../components";
import { useSteps } from "../hooks/use-steps.hook";
import { TxState } from "./tx-state";

type StepsPageProps = {
  session: Maybe<ActionDto>;
  onSignSuccess?: () => void;
  onSubmitSuccess?: () => void;
};

export const StepsPage = ({
  session,
  onSignSuccess,
  onSubmitSuccess,
}: StepsPageProps) => {
  const { retry, txStates } = useSteps({
    session,
    onSignSuccess,
    onSubmitSuccess,
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

const getPosition = (txStatesLenght: number, currentIdx: number) =>
  txStatesLenght === 1
    ? "FIRST"
    : currentIdx === 0
      ? "FIRST"
      : currentIdx === txStatesLenght - 1
        ? "LAST"
        : "ELSE";
