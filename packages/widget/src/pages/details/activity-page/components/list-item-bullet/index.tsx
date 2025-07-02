import { Box } from "@sk-widget/components";

const ListItemBullet = ({
  isFirst,
  isLast,
}: {
  isFirst: boolean;
  isLast: boolean;
}) => (
  <Box
    flex={1}
    display="flex"
    flexDirection="column"
    alignItems="center"
    gap="1"
  >
    <Box
      flex={1}
      width="1"
      background={isFirst ? "transparent" : "tokenSelectBackground"}
    />
    <Box
      width="3"
      height="3"
      borderRadius="full"
      background="tokenSelectBackground"
    />
    <Box
      flex={1}
      width="1"
      background={isLast ? "transparent" : "tokenSelectBackground"}
    />
  </Box>
);

export default ListItemBullet;
