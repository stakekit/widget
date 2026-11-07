import { useState } from "react";

/** A dialog a popup may open from, or the Widget's visible frame. */
const boundarySelector =
  '[role="dialog"], [role="alertdialog"], [data-sk-frame]';

/**
 * What a popup anchored at `anchor` stays inside: the dialog it opens from,
 * else the Widget's frame, else the Widget root, as Base UI's
 * `collisionBoundary`. The viewport when none has a box, such as an inline
 * theme root, or before the anchor mounts.
 */
const boundaryOf = (anchor: Element | null): Element | "clipping-ancestors" => {
  const boundary =
    anchor?.closest(boundarySelector) ?? anchor?.closest("[data-sk-root]");
  if (
    boundary === null ||
    boundary === undefined ||
    getComputedStyle(boundary).display === "contents"
  ) {
    return "clipping-ancestors";
  }
  return boundary;
};

/**
 * A ref callback for a popup's anchor and the collision boundary it yields,
 * so a tooltip or info tip flips and shifts to stay inside the Widget rather
 * than the page.
 */
export const usePopupBoundary = () => {
  const [anchor, setAnchor] = useState<Element | null>(null);
  return { anchorRef: setAnchor, collisionBoundary: boundaryOf(anchor) };
};
