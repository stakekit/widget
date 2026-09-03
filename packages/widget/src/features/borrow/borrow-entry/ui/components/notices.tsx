import { Box } from "../../../../../shared/ui/primitives/box";
import { Text } from "../../../../../shared/ui/primitives/typography/text";
import * as styles from "../styles.css";

export const BorrowInfoNote = ({ children }: { readonly children: string }) => (
  <Box className={styles.infoNote}>
    <Text variant={{ type: "muted", weight: "normal" }}>{children}</Text>
  </Box>
);

export const BorrowDetailsEmpty = ({
  children,
  title,
}: {
  readonly children: string;
  readonly title: string;
}) => (
  <Box
    alignItems="center"
    className={styles.detailsScroll}
    display="flex"
    flexDirection="column"
    gap="2"
    justifyContent="center"
  >
    <Text variant={{ weight: "bold" }}>{title}</Text>
    <Text variant={{ type: "muted", weight: "normal" }}>{children}</Text>
  </Box>
);
