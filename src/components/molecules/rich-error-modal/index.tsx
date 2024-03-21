import { useTranslation } from "react-i18next";
import { Box } from "../../atoms/box";
import { SelectModal } from "../../atoms/select-modal";
import { Heading, Text } from "../../atoms/typography";
import { imageStyle } from "./style.css";
import { useRichErrors } from "../../../hooks/use-rich-errors";
import whatIsLiquidStaking from "../../../assets/images/what-is-liquid-staking.png";

export const RichErrorModal = () => {
  const { t } = useTranslation();
  const { error, resetError } = useRichErrors();
  const { message, details } = error ?? {};

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
        px="6"
        lineHeight="sm"
      >
        <Box as="img" src={whatIsLiquidStaking} className={imageStyle} />
        {!message && (
          <Box marginBottom="6">
            <Heading variant={{ level: "h4" }}>
              {t("shared.something_went_wrong")}
            </Heading>
          </Box>
        )}

        {message && (
          <>
            <Box textAlign="center">
              <Heading variant={{ level: "h4" }}>
                {t(`errors.${message}.title`)}
              </Heading>
              <Text
                variant={{ type: "muted", weight: "normal" }}
                textAlign="center"
              >
                {t(`errors.${message}.details`, details)}
              </Text>
            </Box>

            <Box marginTop="4" textAlign="center">
              <Text variant={{ size: "large" }}>
                {t("error_modal.solution")}
              </Text>

              <Box
                borderRadius="md"
                background="backgroundMuted"
                px="4"
                py="1"
                marginTop="2"
              >
                <Text variant={{ size: "medium" }} textAlign="center">
                  {t(`errors.${message}.solution`)}
                </Text>
              </Box>
            </Box>
          </>
        )}
      </Box>
    </SelectModal>
  );
};
