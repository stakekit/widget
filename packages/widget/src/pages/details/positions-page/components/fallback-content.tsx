import { Box } from "@sk-widget/components/atoms/box";
import { Spinner } from "@sk-widget/components/atoms/spinner";
import { Text } from "@sk-widget/components/atoms/typography/text";
import { ConnectButton } from "@sk-widget/components/molecules/connect-button";
import { useSettings } from "@sk-widget/providers/settings";
import { useTranslation } from "react-i18next";

export const FallbackContent = ({
  type,
}: {
  type:
    | "not_connected"
    | "no_current_positions"
    | "spinner"
    | "something_wrong"
    | "no_previous_activity";
}) => {
  const { t } = useTranslation();

  const { externalProviders } = useSettings();

  const getContent = () => {
    if (type === "spinner") {
      return (
        <Box display="flex" justifyContent="center">
          <Spinner />
        </Box>
      );
    }
    if (type === "not_connected" && !externalProviders) {
      return <ConnectButton />;
    }
    if (type === "something_wrong") {
      return (
        <Text variant={{ type: "danger" }} textAlign="center">
          {t("shared.something_went_wrong")}
        </Text>
      );
    }
    if (type === "no_current_positions") {
      return (
        <Text variant={{ weight: "medium" }} textAlign="center">
          {t("positions.no_current_positions")}
        </Text>
      );
    }
    if (type === "no_previous_activity") {
      return (
        <Text variant={{ weight: "medium" }} textAlign="center">
          {t("activity.no_previous_activity")}
        </Text>
      );
    }

    return null;
  };

  return (
    <Box marginTop="2" marginBottom="4">
      {getContent()}
    </Box>
  );
};
