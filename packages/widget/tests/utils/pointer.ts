import { cdp } from "vitest/browser";

/** Moves the browser's pointer off the page, so nothing under it is hovered. */
export const movePointerOffPage = async () => {
  await cdp().send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: -1,
    y: -1,
  });
};
