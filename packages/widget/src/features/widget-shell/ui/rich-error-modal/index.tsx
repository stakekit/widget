import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button, Card, Modal, Spot, Stack, Text } from "../../../../ui/index";
import { richErrorInterpolationValues } from "../../model/rich-error-interpolation-values";
import { useRichErrors } from "../../react/use-rich-errors";

/**
 * The rich error dialog, for a failure no page section shows on its own: the
 * error's Error Copy (title, details and a potential solution), or, for an
 * error without copy, "Something went wrong" and what to do next. It always
 * ends with a way to close it.
 */
export const RichErrorModal = () => {
  const { i18n, t } = useTranslation();
  const { error, resetError } = useRichErrors();
  const { message, details } = error ?? {};
  const knownMessage =
    message &&
    (["title", "details", "solution"] as const).every((field) =>
      i18n.exists(`errors.${message}.${field}`)
    )
      ? message
      : null;
  useEffect(() => resetError, [resetError]);

  return (
    <Modal
      open={!!error}
      onOpenChange={(open) => {
        if (!open) resetError();
      }}
      title={
        knownMessage
          ? t(`errors.${knownMessage}.title`)
          : t("shared.something_went_wrong")
      }
      closeLabel={t("shared.close")}
      footer={
        <Button variant="secondary" size="cta" onClick={resetError}>
          {t("error_modal.dismiss")}
        </Button>
      }
    >
      <Stack align="center" gap={16}>
        <Spot icon="WarningIcon" tone="danger" size="lg" />
        {knownMessage ? (
          <>
            <Text as="p" tone="muted" align="center">
              {t(
                `errors.${knownMessage}.details`,
                richErrorInterpolationValues(details)
              )}
            </Text>
            <Stack gap={8} align="stretch">
              <Text variant="heading" as="h3" align="center">
                {t("error_modal.solution")}
              </Text>
              <Card>
                <Text as="p" align="center">
                  {t(`errors.${knownMessage}.solution`)}
                </Text>
              </Card>
            </Stack>
          </>
        ) : (
          <Text as="p" tone="muted" align="center">
            {t("error_modal.generic_description")}
          </Text>
        )}
      </Stack>
    </Modal>
  );
};
