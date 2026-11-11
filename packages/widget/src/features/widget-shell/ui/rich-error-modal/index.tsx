import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { Button, Modal, Notice } from "../../../../ui/index";
import { richErrorInterpolationValues } from "../../model/rich-error-interpolation-values";
import { useRichErrors } from "../use-rich-errors";

/**
 * The rich error dialog, for a failure no page section shows on its own: the
 * error's Error Copy (title, details as the dialog's message, and a potential
 * solution in a notice under it), or, for an error without copy, "Something
 * went wrong" and what to do next. It ends with "Try again" when the failed
 * work can run again, and always with a way to close it.
 */
export const RichErrorModal = () => {
  const { i18n, t } = useTranslation();
  const { error, resetError, retry } = useRichErrors();
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
      description={
        knownMessage
          ? t(
              `errors.${knownMessage}.details`,
              richErrorInterpolationValues(details)
            )
          : t("error_modal.generic_description")
      }
      closeLabel={t("shared.close")}
      initialFocus="dialog"
      footer={
        <>
          {retry !== null && (
            <Button variant="primary" size="cta" onClick={retry}>
              {t("shared.retry")}
            </Button>
          )}
          <Button variant="secondary" size="cta" onClick={resetError}>
            {t("error_modal.dismiss")}
          </Button>
        </>
      }
    >
      {knownMessage && (
        <Notice tone="info" title={t("error_modal.solution")}>
          {t(`errors.${knownMessage}.solution`)}
        </Notice>
      )}
    </Modal>
  );
};
