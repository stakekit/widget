import { Separator } from "@base-ui/react/separator";
import * as stylex from "@stylexjs/stylex";

import { borderWidth } from "../tokens/border.stylex";
import { color } from "../tokens/color.stylex";

/** A line that separates content; screen readers announce it as a separator. */
export const Divider = ({
  orientation = "horizontal",
}: {
  readonly orientation?: keyof typeof orientationStyles;
}) => (
  <Separator
    orientation={orientation}
    {...stylex.props(styles.root, orientationStyles[orientation])}
  />
);

const styles = stylex.create({
  root: {
    margin: 0,
    borderStyle: "none",
    backgroundColor: color.border,
    flexShrink: 0,
  },
});

const orientationStyles = stylex.create({
  horizontal: { height: borderWidth.thin, width: "100%" },
  vertical: { alignSelf: "stretch", width: borderWidth.thin },
});
