import clsx from "clsx";
import { Box } from "../../../../shared/ui/primitives/box";
import { Text } from "../../../../shared/ui/primitives/typography/text";
import * as styles from "../styles.css";

export const BorrowNotice = ({
  children,
  title,
  tone,
}: {
  readonly children: string;
  readonly title: string;
  readonly tone?: "error";
}) => (
  <Box className={styles.mutedPanel}>
    <Text
      className={tone === "error" ? styles.errorText : undefined}
      variant={{ weight: "bold" }}
    >
      {title}
    </Text>
    <Text variant={{ type: "muted", weight: "normal" }}>{children}</Text>
  </Box>
);

export const BorrowInfoNote = ({
  children,
  tone = "default",
}: {
  readonly children: string;
  readonly tone?: "default" | "error";
}) => (
  <Box
    className={clsx(styles.infoNote, tone === "error" && styles.infoNoteError)}
  >
    <Text
      variant={{
        type: tone === "error" ? "danger" : "muted",
        weight: "normal",
      }}
    >
      {children}
    </Text>
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
