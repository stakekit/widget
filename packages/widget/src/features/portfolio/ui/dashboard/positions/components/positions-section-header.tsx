import { useTranslation } from "react-i18next";
import type { YieldCategory } from "../../../../../../domain/earn/contract";
import { Box, Stack, Text } from "../../../../../../ui/index";

export const PositionsSectionHeader = ({
  category,
  count,
}: {
  category: YieldCategory | "borrow";
  count: number;
}) => {
  const { t } = useTranslation();

  return (
    <Box paddingBlock={8}>
      <Stack direction="row" align="center" justify="between" gap={8}>
        <Text variant="overline" tone="muted">
          {t(`dashboard.details.positions_sections.${category}`)}
        </Text>
        <Text variant="caption" tone="muted" numeric>
          {count}
        </Text>
      </Stack>
    </Box>
  );
};
