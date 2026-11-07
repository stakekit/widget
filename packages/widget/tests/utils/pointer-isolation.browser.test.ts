import { describe, expect, it, onTestFinished } from "vitest";
import { userEvent } from "vitest/browser";

/** A target covering the page, so the pointer is over it wherever it is. */
const mountTarget = () => {
  const target = document.createElement("button");
  target.style.cssText = "position: fixed; inset: 0;";
  document.body.append(target);
  onTestFinished(() => target.remove());
  return target;
};

// The two tests run in order: the first leaves the pointer over the page.
describe("Pointer between tests", () => {
  it("is left over the page by a hover", async () => {
    const target = mountTarget();

    await userEvent.hover(target);

    expect(target.matches(":hover")).toBe(true);
  });

  it("starts off the page, so nothing mounts hovered", async () => {
    const target = mountTarget();
    // Hover follows the pointer once a frame lays the target out.
    for (const _ of [1, 2]) {
      const frame = Promise.withResolvers<void>();
      requestAnimationFrame(() => frame.resolve());
      await frame.promise;
    }

    expect(target.matches(":hover")).toBe(false);
  });
});
