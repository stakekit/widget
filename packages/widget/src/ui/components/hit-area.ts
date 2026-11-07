import * as stylex from "@stylexjs/stylex";
import { pointer } from "../tokens/pointer.stylex";
import { hitArea } from "../tokens/size.stylex";

// How far the hit area reaches past each edge: half of what the control
// lacks of `hitArea.coarse` along that axis, and nothing where it is already
// that large. An inset's percentage reads the control's height on the block
// edges and its width on the inline ones.
const reach = `min(0%, calc((100% - ${hitArea.coarse}) / 2))`;

/**
 * Grows a control's hit area to `hitArea.coarse` under a coarse pointer
 * without changing how it looks or takes room: an invisible `::before`,
 * centered on the control, catches the taps just around it. A fine pointer
 * keeps the drawn size. The control becomes the pseudo-element's containing
 * block, so it must not need another `position`.
 */
export const hitAreaStyles = stylex.create({
  coarse: {
    position: "relative",
    "::before": {
      inset: { default: null, [pointer.coarse]: reach },
      content: { default: null, [pointer.coarse]: '""' },
      position: { default: null, [pointer.coarse]: "absolute" },
    },
  },
});
