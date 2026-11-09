import { useTranslation } from "react-i18next";

import { ErrorState } from "../../../../ui/index";

/**
 * The position failed to load with nothing to show: one error in the place of
 * what it would show, with a retry.
 */
export const PositionDetailsLoadFailed = ({
  onRetry,
}: {
  readonly onRetry: () => void;
}) => {
  const { t } = useTranslation();

  return (
    <ErrorState
      fill
      testId="position-details-load-failed"
      title={t("position_details.load_failed_title")}
      body={t("shared.load_failed_description")}
      action={{ label: t("shared.retry"), onClick: onRetry }}
    />
  );
};
