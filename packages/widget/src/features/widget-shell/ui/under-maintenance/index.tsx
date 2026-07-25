import { useTranslation } from "react-i18next";
import { images } from "../../../../shared/assets/images";
import { Box } from "../../../../shared/ui/primitives/box";
import { Heading } from "../../../../shared/ui/primitives/typography/heading";
import { Text } from "../../../../shared/ui/primitives/typography/text";
import { animationContainer } from "../layout.css";
import { PoweredBy } from "../powered-by";
import { container, imageStyle } from "./style.css";

const UnderMaintenance = () => {
  const { t } = useTranslation();

  return (
    <Box className={animationContainer}>
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        paddingBottom={{ mobile: "8" }}
        className={container}
        data-testid="under-maintenance"
      >
        <Box as="img" src={images.fees} className={imageStyle} />
        <Box>
          <Heading
            marginBottom="4"
            textAlign="center"
            variant={{ level: "h4" }}
          >
            {t("help_modals.under_maintenance.title")}
          </Heading>

          <Text
            variant={{ type: "muted", weight: "normal" }}
            textAlign="center"
            marginBottom="4"
          >
            {t("help_modals.under_maintenance.description")}
          </Text>
          <Text
            variant={{ type: "muted", weight: "normal" }}
            textAlign="center"
            marginBottom="4"
          >
            {t("help_modals.under_maintenance.description2")}
          </Text>
        </Box>
      </Box>
      <PoweredBy opacity={1} />
    </Box>
  );
};

export default UnderMaintenance;
