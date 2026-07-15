import { useTranslation } from "react-i18next";
import type { DashboardYieldCategory } from "../../../../../../domain/types/yields";
import { Box } from "../../../../../../shared/ui/primitives/box";
import { Text } from "../../../../../../shared/ui/primitives/typography/text";
import { sectionHeader, sectionTitle } from "../styles.css";

export const PositionsSectionHeader = ({
  category,
  count,
}: {
  category: DashboardYieldCategory | "borrow";
  count: number;
}) => {
  const { t } = useTranslation();

  return (
    <Box className={sectionHeader} paddingTop="3" paddingBottom="1">
      <Text
        className={sectionTitle}
        variant={{ type: "muted", weight: "semibold", size: "small" }}
      >
        {t(`dashboard.details.positions_sections.${category}`)}
      </Text>

      <Text variant={{ type: "muted", weight: "normal", size: "small" }}>
        {count}
      </Text>
    </Box>
  );
};
