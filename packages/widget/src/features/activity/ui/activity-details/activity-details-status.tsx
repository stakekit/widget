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

export const ActivityDetailsUnavailable = () => {
  const { t } = useTranslation();
  return (
    <Stack align="center" justify="center" grow>
      <EmptyState
        icon="InfoIcon"
        title={t("activity.details.unavailable_title")}
        body={t("activity.details.unavailable_description")}
      />
    </Stack>
  );
};
