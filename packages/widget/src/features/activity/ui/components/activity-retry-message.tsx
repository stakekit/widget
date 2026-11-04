import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { ErrorState } from "../../../../ui/index";

export const ActivityRetryMessage = ({
  onRetry,
}: {
  readonly onRetry: () => void;
}): ReactElement => {
  const { t } = useTranslation();
  return (
    <ErrorState
      title={t("shared.something_went_wrong")}
      action={{ label: t("shared.retry"), onClick: onRetry }}
    />
  );
};
