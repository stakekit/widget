import { Box } from "@sk-widget/components/atoms/box";
import { WarningIcon } from "@sk-widget/components/atoms/icons/warning";
import { Text } from "@sk-widget/components/atoms/typography/text";

export const WarningBox = ({ text }: { text: string }) => (
  <Box
    borderRadius="md"
    px="2"
    py="1"
    display="inline-flex"
    justifyContent="center"
    alignItems="center"
    gap="3"
    background="warningBoxBackground"
  >
    <Box display="flex" justifyContent="center" alignItems="center">
      <WarningIcon />
    </Box>

    <Box>
      <Text lineHeight="short">{text}</Text>
    </Box>
  </Box>
);
