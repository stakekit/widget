import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { images } from "../../../assets/images";
import { useRichErrors } from "../../../hooks/use-rich-errors";
import { Box } from "../../atoms/box";
import { SelectModal } from "../../atoms/select-modal";
import { Heading } from "../../atoms/typography/heading";
import { Text } from "../../atoms/typography/text";
import { imageStyle } from "./style.css";

export const RichErrorModal = () => {
  const { i18n, t } = useTranslation();
  const { error, resetError } = useRichErrors();
  const { message, details } = error ?? {};
  const hasKnownMessage = message ? i18n.exists(`errors.${message}`) : false;

  useEffect(() => resetError, [resetError]);

  return (
    <SelectModal
      state={{ isOpen: !!error, setOpen: (isOpen) => !isOpen && resetError() }}
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
        <Box as="img" src={images.whatIsLiquidStaking} className={imageStyle} />
        {!message && (
          <Box marginBottom="6">
            <Heading variant={{ level: "h4" }}>
              {t("shared.something_went_wrong")}
            </Heading>
          </Box>
        )}

        {message && hasKnownMessage && (
          <>
            <Box textAlign="center">
              <Heading variant={{ level: "h4" }}>
                {t(`errors.${message}.title`)}
              </Heading>
              <Text
                variant={{ type: "muted", weight: "normal" }}
                textAlign="center"
                marginTop="2"
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

        {message && !hasKnownMessage && (
          <Box textAlign="center">
            <Heading variant={{ level: "h4" }}>
              {t("shared.something_went_wrong")}
            </Heading>
            <Text
              variant={{ type: "muted", weight: "normal" }}
              textAlign="center"
              marginTop="2"
            >
              {message}
            </Text>
          </Box>
        )}
      </Box>
    </SelectModal>
  );
};
