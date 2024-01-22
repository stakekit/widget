import { useTranslation } from "react-i18next";
import { Box } from "../../atoms/box";
import { SelectModal } from "../../atoms/select-modal";
import { Heading, Text } from "../../atoms/typography";
import { container } from "./style.css";
import { useReachErrors } from "../../../hooks/use-reach-errors";

export const ReachErrorModal = () => {
  const { t } = useTranslation();
  const { error, resetError } = useReachErrors();

  return (
    <SelectModal
      state={{ isOpen: !!error, setOpen: () => resetError() }}
      onClose={resetError}
    >
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        paddingBottom={{ mobile: "8" }}
        className={container}
      >
        <Heading variant={{ level: "h4" }}>Error</Heading>
        <Box marginTop="2" lineHeight="short">
          <Text
            variant={{ type: "muted", weight: "normal" }}
            textAlign="center"
          >
            {t(`${error?.message}.title`)}
          </Text>
          <Text
            variant={{ type: "muted", weight: "normal" }}
            textAlign="center"
          >
            {t(`${error?.message}.details`, error?.details ?? {})}
          </Text>
          <Text
            variant={{ type: "muted", weight: "normal" }}
            textAlign="center"
          >
            {t(`${error?.message}.solution`)}
          </Text>
        </Box>
      </Box>
    </SelectModal>
  );
};
