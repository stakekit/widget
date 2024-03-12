import { Box } from "../box";
import { WarningIcon } from "../icons/warning";
import { Text } from "../typography";

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
