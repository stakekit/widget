import { Box, Heading, Text } from "@sk-widget/components";
import { useTranslation } from "react-i18next";

import { images } from "@sk-widget/assets/images";
import { container, imageStyle } from "./style.css";

const UnderMaintenance = () => {
  const { t } = useTranslation();

  return (
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
          >
            {t("help_modals.under_maintenance.description")}
          </Text>
        </Box>
      </Box>
    </Box>
  );
};

export default UnderMaintenance;
