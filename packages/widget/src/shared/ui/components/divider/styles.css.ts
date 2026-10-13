import { style } from "@vanilla-extract/css";
import { atoms } from "../../../styles/theme/atoms.css";

// `backgroundMuted` matches card surfaces in the light theme (and in finery),
// so separators use the dedicated border token in every variant.
export const divider = atoms({
  background: "tabBorder",
  height: "px",
  width: "full",
});

export const verticalDivider = style([
  atoms({ background: "tabBorder" }),
  {
    alignSelf: "stretch",
    width: "1px",
    marginTop: "-18px",
  },
]);
