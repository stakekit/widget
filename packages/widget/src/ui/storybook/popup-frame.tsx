import type { ReactNode } from "react";
import { Stack } from "../primitives/stack";

/**
 * For stories only: a stand-in for the Widget's frame (`data-sk-frame`), the
 * box a popup keeps inside, outlined, on a page with room beyond it above and
 * to its left. Its content sits in a row at its top right corner, so a popup
 * opened there has to flip or shift to stay inside. A play test finds it by
 * the `frame` test id.
 */
export const PopupFrame = ({ children }: { readonly children: ReactNode }) => (
  <div style={{ paddingTop: 160, paddingLeft: 24 }}>
    <div
      data-sk-frame=""
      data-testid="frame"
      style={{
        width: 320,
        height: 240,
        padding: 8,
        boxSizing: "border-box",
        outline: "1px dashed gray",
      }}
    >
      <Stack direction="row" align="center" justify="end" gap={4}>
        {children}
      </Stack>
    </div>
  </div>
);
