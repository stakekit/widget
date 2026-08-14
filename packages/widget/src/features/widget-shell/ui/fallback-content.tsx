import { useTranslation } from "react-i18next";
import { useWidgetConfig } from "../../../app/composition/use-widget-config";
import { Box } from "../../../shared/ui/primitives/box";
import { Spinner } from "../../../shared/ui/primitives/spinner";
import { Text } from "../../../shared/ui/primitives/typography/text";
import { ConnectButton } from "../../wallet/ui";

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

  const externalProviders = useWidgetConfig("externalProviders");

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
