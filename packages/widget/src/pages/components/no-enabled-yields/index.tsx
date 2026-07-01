import { useTranslation } from "react-i18next";
import { Box } from "../../../components/atoms/box";
import { Heading } from "../../../components/atoms/typography/heading";
import { Text } from "../../../components/atoms/typography/text";
import { wrapper } from "../../../pages-dashboard/common/components/styles.css";
import { useSettings } from "../../../providers/settings";
import { combineRecipeWithVariant } from "../../../utils/styles";
import { PoweredBy } from "../powered-by";
import { background, container, dashboardBackground } from "./style.css";

const NoEnabledYields = () => {
  const { t } = useTranslation();
  const { dashboardVariant, variant } = useSettings();

  return (
    <Box
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
            {t("no_enabled_yields.title")}
          </Heading>

          <Text
            variant={{ type: "muted", weight: "normal" }}
            textAlign="center"
            marginBottom="4"
          >
            {t("no_enabled_yields.description")}
          </Text>
        </Box>
      </Box>
      <PoweredBy opacity={1} />
    </Box>
  );
};

export default NoEnabledYields;
