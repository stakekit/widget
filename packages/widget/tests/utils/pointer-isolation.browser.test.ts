import { expect, it, onTestFinished } from "vitest";
import { userEvent } from "vitest/browser";
import { movePointerOffPage } from "./pointer";

const nextFrame = () => {
  const frame = Promise.withResolvers<void>();
  requestAnimationFrame(() => frame.resolve());
  return frame.promise;
};

// Every browser test starts with this reset (see setup.browser.ts).
it("moves the pointer a hover left over the page off it", async () => {
  // A target covering the page, so the pointer is over it wherever it is.
  const target = document.createElement("button");
  target.style.cssText = "position: fixed; inset: 0;";
  document.body.append(target);
  onTestFinished(() => target.remove());
  await userEvent.hover(target);
  expect(target.matches(":hover")).toBe(true);

  await movePointerOffPage();
  // Hover follows the pointer once a frame lays the page out.
  await nextFrame();
  await nextFrame();

  expect(target.matches(":hover")).toBe(false);
});
