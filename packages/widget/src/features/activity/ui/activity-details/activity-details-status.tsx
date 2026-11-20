import { useTranslation } from "react-i18next";

import { EmptyState, Stack } from "../../../../ui/index";
import { ActivityRetryMessage } from "../components/activity-retry-message";

export const ActivityDetailsFailure = ({
  onRetry,
}: {
  readonly onRetry: () => void;
}) => (
  <Stack align="center" justify="center" grow>
    <ActivityRetryMessage onRetry={onRetry} />
  </Stack>
);

/**
 * No action to show. Where the action may yet load, such as the action an
 * Activity pane selects by default, it offers to look again.
 */
export const ActivityDetailsUnavailable = ({
  onRetry,
}: {
  readonly onRetry?: () => void;
}) => {
  const { t } = useTranslation();
  return (
    <Stack align="center" justify="center" grow>
      <EmptyState
        testId="activity-details-unavailable"
        icon="InfoIcon"
        title={t("activity.details.unavailable_title")}
        body={t("activity.details.unavailable_description")}
        {...(onRetry === undefined
          ? {}
          : { action: { label: t("shared.retry"), onClick: onRetry } })}
      />
    </Stack>
  );
};
