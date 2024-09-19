import { Box, Heading, Text } from "@sk-widget/components";
import { useTranslation } from "react-i18next";

import { images } from "@sk-widget/assets/images";
import { PoweredBy } from "@sk-widget/pages/components/powered-by";
import { animationContainer } from "@sk-widget/style.css";
import { container, description, imageStyle } from "./style.css";

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
          <Heading textAlign="center" variant={{ level: "h4" }}>
            {t("help_modals.under_maintenance.title")}
          </Heading>

          <Box marginTop="2" lineHeight="short">
            <Text
              variant={{ type: "muted", weight: "normal" }}
              textAlign="center"
              className={description}
            >
              {t("help_modals.under_maintenance.description")}
            </Text>
          </Box>
        </Box>
      </Box>
      <PoweredBy opacity={1} />
    </Box>
  );
};

export default UnderMaintenance;
