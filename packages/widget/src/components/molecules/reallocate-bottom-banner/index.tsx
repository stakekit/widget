import { useTranslation } from "react-i18next";
import { Box } from "../../atoms/box";
import { Balance } from "../../atoms/icons/balance";
import { Text } from "../../atoms/typography/text";
import { bottomBanner, bottomBannerText } from "./styles.css";

export const ReallocateBottomBanner = () => {
  const { t } = useTranslation();

  return (
    <Box
      className={bottomBanner}
      px="2"
      py="3"
      display="flex"
      gap="2"
      justifyContent="center"
    >
      <Balance />
      <Text className={bottomBannerText}>
        {t("position_details.trust_reallocate")}
      </Text>
    </Box>
  );
};
