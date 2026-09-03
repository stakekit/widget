import { Box } from "../box";
import { Text } from "../typography/text";
import * as styles from "./styles.css";

type HeaderBadgeTone = "default" | "auto";

export const HeaderBadge = ({
  label,
  tone = "default",
}: {
  label: string;
  tone?: HeaderBadgeTone;
}) => (
  <Box
    className={tone === "auto" ? styles.headerAutoBadge : styles.headerBadge}
  >
    <Text
      as="span"
      className={styles.headerBadgeText}
      variant={{ type: "base", weight: "bold", size: "small" }}
    >
      {label}
    </Text>
  </Box>
);
