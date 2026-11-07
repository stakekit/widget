import * as stylex from "@stylexjs/stylex";

import { Skeleton } from "../components/skeleton";
import { VisuallyHidden } from "../primitives/visually-hidden";
import { color } from "../tokens/color.stylex";
import { radius } from "../tokens/radius.stylex";
import { space } from "../tokens/space.stylex";

const rowKeys = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;

/**
 * Stand-in rows for a list of `card` `ListRow`s that is loading, such as
 * positions or activity: each row an avatar, a title and a caption line and
 * a trailing value, at a loaded row's height, so the list keeps its place.
 * The list says it is busy; the rows are decorative.
 */
export const ListSkeleton = ({
  rows = 5,
  label,
  testId,
}: {
  /** How many rows, at most eight. */
  readonly rows?: number;
  /** Says what is loading, such as "Loading positions". */
  readonly label: string;
  /** Renders as the list's `data-testid`. */
  readonly testId?: string;
}) => (
  <div
    role="status"
    aria-busy="true"
    data-testid={testId}
    {...stylex.props(styles.list)}
  >
    <VisuallyHidden>{label}</VisuallyHidden>
    {rowKeys.slice(0, rows).map((key) => (
      <div key={key} aria-hidden="true" {...stylex.props(styles.row)}>
        <Skeleton shape="circle" size="md" />
        <div {...stylex.props(styles.lines)}>
          <Skeleton shape="line" width="half" />
          <Skeleton shape="line" width="quarter" />
        </div>
        <div {...stylex.props(styles.trailing)}>
          <Skeleton shape="line" width="full" />
        </div>
      </div>
    ))}
  </div>
);

const styles = stylex.create({
  list: { gap: space[8], display: "flex", flexDirection: "column" },
  // A `card` ListRow's box.
  row: {
    borderRadius: radius.control,
    gap: space[12],
    paddingBlock: space[12],
    paddingInline: space[12],
    alignItems: "center",
    backgroundColor: color.surface,
    display: "flex",
  },
  lines: {
    gap: space[4],
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    minWidth: 0,
  },
  trailing: { flexBasis: "20%", flexShrink: 0 },
});
