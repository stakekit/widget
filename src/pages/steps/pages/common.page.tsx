import { useTranslation } from "react-i18next";
import { Box, Button, Heading } from "../../../components";
import { PageContainer } from "../../components";
import { useSteps } from "../hooks/use-steps.hook";
import { Maybe } from "purify-ts";
import { ActionDto } from "@stakekit/api-hooks";
import { TxState } from "./tx-state";

type StepsPageProps = {
  session: Maybe<ActionDto>;
  onDone?: () => void;
  onSignSuccess?: () => void;
  onSubmitSuccess?: () => void;
};

export const StepsPage = ({
  session,
  onDone,
  onSignSuccess,
  onSubmitSuccess,
}: StepsPageProps) => {
  const { retry, txStates, onClick } = useSteps({
    session,
    onDone,
    onSignSuccess,
    onSubmitSuccess,
  });

  const { t } = useTranslation();

  return (
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
              position={
                i === 0 ? "FIRST" : i === txStates.length - 1 ? "LAST" : "ELSE"
              }
              count={
                txStates.length > 1
                  ? { current: i + 1, total: txStates.length }
                  : null
              }
            />
          ))}
        </Box>
      </Box>

      {retry && (
        <Box my="4">
          <Button onClick={retry}>{t("shared.retry")}</Button>
        </Box>
      )}

      <Box display="flex" alignItems="flex-end" marginTop="8">
        <Button onClick={onClick} variant={{ color: "secondary" }}>
          {t("shared.cancel")}
        </Button>
      </Box>
    </PageContainer>
  );
};
