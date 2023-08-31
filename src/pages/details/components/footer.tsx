import { useTranslation } from "react-i18next";
import {
  ArrowsLeftRightIcon,
  Box,
  ClockClockWiseIcon,
  GifIcon,
  Text,
} from "../../../components";

type FooterProps = {
  description: string | null;
};

export const Footer = ({ description }: FooterProps) => {
  const { t } = useTranslation();

  return (
    <Box gap="3" display="flex" flexDirection="column">
      {description && (
        <Box display="flex" alignItems="center">
          <Box hw="4" marginRight="2">
            <ArrowsLeftRightIcon />
          </Box>
          <Text
            variant={{
              weight: "normal",
              type: "muted",
              size: "small",
            }}
          >
            {description}
          </Text>
        </Box>
      )}

      <Box display="flex" alignItems="center">
        <Box hw="4" marginRight="2">
          <ClockClockWiseIcon />
        </Box>
        <Text
          variant={{
            weight: "normal",
            type: "muted",
            size: "small",
          }}
        >
          {t("details.info_2")}
        </Text>
      </Box>

      <Box display="flex" alignItems="center">
        <Box hw="4" marginRight="2">
          <GifIcon />
        </Box>
        <Text
          variant={{
            weight: "normal",
            type: "muted",
            size: "small",
          }}
        >
          {t("details.info_3")}
        </Text>
      </Box>
    </Box>
  );
};
