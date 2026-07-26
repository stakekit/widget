import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { images } from "../../../assets/images";
import { type RichError, useRichErrors } from "../../../hooks/use-rich-errors";
import { Box } from "../../atoms/box";
import { Button } from "../../atoms/button";
import { SelectModal } from "../../atoms/select-modal";
import { Heading } from "../../atoms/typography/heading";
import { Text } from "../../atoms/typography/text";
import { imageStyle } from "./style.css";

type Props = {
  error?: RichError | null;
  isOpen?: boolean;
  onClose?: () => void;
  action?: { label: string; onClick: () => void };
  description?: string;
};

export const RichErrorModal = ({
  error: controlledError,
  isOpen,
  onClose,
  action,
  description,
}: Props = {}) => {
  const { i18n, t } = useTranslation();
  const { error: richError, resetError } = useRichErrors();
  const error = controlledError === undefined ? richError : controlledError;
  const close = onClose ?? resetError;
  const { message, details } = error ?? {};
  const hasKnownMessage = message ? i18n.exists(`errors.${message}`) : false;

  useEffect(() => resetError, [resetError]);

  return (
    <SelectModal
      state={{ isOpen: isOpen ?? !!error, setOpen: (open) => !open && close() }}
      onClose={close}
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
          <Box marginBottom="6" textAlign="center">
            <Heading variant={{ level: "h4" }}>
              {t("shared.something_went_wrong")}
            </Heading>

            {description && (
              <Text
                variant={{ type: "muted", weight: "normal" }}
                textAlign="center"
                marginTop="2"
              >
                {description}
              </Text>
            )}
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

        {action && (
          <Box marginTop="6" width="full">
            <Button variant={{ color: "secondary" }} onClick={action.onClick}>
              <Text variant={{ weight: "bold", size: "large" }}>
                {action.label}
              </Text>
            </Button>
          </Box>
        )}
      </Box>
    </SelectModal>
  );
};
