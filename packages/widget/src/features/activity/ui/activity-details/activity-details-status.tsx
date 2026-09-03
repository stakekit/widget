import { useTranslation } from "react-i18next";
import { Box } from "../../../../shared/ui/primitives/box";
import { Button } from "../../../../shared/ui/primitives/button";
import { Text } from "../../../../shared/ui/primitives/typography/text";

export const ActivityDetailsFailure = ({
  onRetry,
}: {
  readonly onRetry: () => void;
}) => {
  const { t } = useTranslation();
  return (
    <Box
      alignItems="center"
      display="flex"
      flex={1}
      flexDirection="column"
      gap="3"
      justifyContent="center"
    >
      <Text variant={{ type: "danger" }} textAlign="center">
        {t("shared.something_went_wrong")}
      </Text>
      <Button onClick={onRetry}>{t("shared.retry")}</Button>
    </Box>
  );
};

export const ActivityDetailsUnavailable = () => {
  const { t } = useTranslation();
  return (
    <Box
      alignItems="center"
      display="flex"
      flex={1}
      flexDirection="column"
      gap="2"
      justifyContent="center"
    >
      <Text variant={{ weight: "medium" }} textAlign="center">
        {t("activity.details.unavailable_title")}
      </Text>
      <Text variant={{ type: "muted", weight: "normal" }} textAlign="center">
        {t("activity.details.unavailable_description")}
      </Text>
    </Box>
  );
};
