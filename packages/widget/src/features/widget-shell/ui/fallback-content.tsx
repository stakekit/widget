import { useTranslation } from "react-i18next";
import { useWidgetConfig } from "../../../features/widget-configuration/index";
import { Box, Spinner, Stack, Text } from "../../../ui/index";
import { ConnectButton } from "../../wallet/views";

export const FallbackContent = ({
  type,
}: {
  readonly type:
    | "not_connected"
    | "no_current_positions"
    | "spinner"
    | "something_wrong"
    | "no_previous_activity";
}) => {
  const { t } = useTranslation();
  const externalProviders = useWidgetConfig("externalProviders");

  const content = (() => {
    switch (type) {
      case "spinner":
        return (
          <Stack align="center">
            <Spinner />
          </Stack>
        );
      case "not_connected":
        return externalProviders ? null : <ConnectButton />;
      case "something_wrong":
        return (
          <Text as="p" tone="danger" align="center">
            {t("shared.something_went_wrong")}
          </Text>
        );
      case "no_current_positions":
        return (
          <Text as="p" weight="medium" align="center">
            {t("positions.no_current_positions")}
          </Text>
        );
      case "no_previous_activity":
        return (
          <Text as="p" weight="medium" align="center">
            {t("activity.no_previous_activity")}
          </Text>
        );
    }
  })();

  return <Box paddingBlock={16}>{content}</Box>;
};
