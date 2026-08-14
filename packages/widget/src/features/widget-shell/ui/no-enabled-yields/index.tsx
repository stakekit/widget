import { useTranslation } from "react-i18next";
import { useWidgetConfig } from "../../../../app/composition/use-widget-config";
import { combineRecipeWithVariant } from "../../../../shared/styles/recipe-variant";
import { Box } from "../../../../shared/ui/primitives/box";
import { Heading } from "../../../../shared/ui/primitives/typography/heading";
import { Text } from "../../../../shared/ui/primitives/typography/text";
import { wrapper } from "../../dashboard/components/styles.css";
import { PoweredBy } from "../powered-by";
import { background, container, dashboardBackground } from "./style.css";

export const NoEnabledYields = () => {
  const { t } = useTranslation();
  const dashboardVariant = useWidgetConfig("dashboardVariant");
  const variant = useWidgetConfig("variant");

  return (
    <Box
      style={{ borderRadius: "14px" }}
      className={
        dashboardVariant
          ? [
              combineRecipeWithVariant({ rec: wrapper, variant }),
              dashboardBackground,
            ]
          : background
      }
    >
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        paddingBottom={{ mobile: "8" }}
        className={container}
        data-testid="no-enabled-yields"
      >
        <Box>
          <Heading
            marginBottom="4"
            textAlign="center"
            variant={{ level: "h4" }}
          >
            {t("help_modals.no_enabled_yields.title")}
          </Heading>

          <Text
            variant={{ type: "muted", weight: "normal" }}
            textAlign="center"
            marginBottom="4"
          >
            {t("help_modals.no_enabled_yields.description")}
          </Text>
        </Box>
      </Box>
      <PoweredBy opacity={1} />
    </Box>
  );
};
