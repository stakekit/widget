import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { ErrorState } from "../../../../ui/index";

/** A failed Activity request, in place of what it would show, with a retry. */
export const ActivityRetryMessage = ({
  onRetry,
  title,
  fill = false,
}: {
  readonly onRetry: () => void;
  /** What failed; "Something went wrong" unset. */
  readonly title?: string;
  readonly fill?: boolean;
}): ReactElement => {
  const { t } = useTranslation();
  return (
    <ErrorState
      fill={fill}
      title={title ?? t("shared.something_went_wrong")}
      body={t("shared.load_failed_description")}
      action={{ label: t("shared.retry"), onClick: onRetry }}
    />
  );
};
