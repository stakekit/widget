import { useTranslation } from "react-i18next";
import { Box, Spinner, Text } from "../../../../components";
import { ConnectButton } from "../../../../components/molecules/connect-button";
import { useSettings } from "../../../../providers/settings";

export const FallbackContent = ({
  type,
}: {
  type:
    | "not_connected"
    | "no_current_positions"
    | "spinner"
    | "something_wrong";
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
    } else if (type === "not_connected" && !externalProviders) {
      return <ConnectButton />;
    } else if (type === "something_wrong") {
      return (
        <Text variant={{ type: "danger" }} textAlign="center">
          {t("shared.something_went_wrong")}
        </Text>
      );
    } else if (type === "no_current_positions") {
      return (
        <Text variant={{ weight: "medium" }} textAlign="center">
          {t("positions.no_current_positions")}
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
