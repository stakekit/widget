import { Box } from "../../../../shared/ui/primitives/box";
import { Text } from "../../../../shared/ui/primitives/typography/text";
import * as styles from "./styles.css";

export const BorrowNotice = ({
  children,
  title,
  tone,
}: {
  readonly children: string;
  readonly title: string;
  readonly tone?: "error";
}) => (
  <Box className={styles.notice}>
    <Text
      className={tone === "error" ? styles.errorText : undefined}
      variant={{ weight: "bold" }}
    >
      {title}
    </Text>
    <Text variant={{ type: "muted", weight: "normal" }}>{children}</Text>
  </Box>
);
