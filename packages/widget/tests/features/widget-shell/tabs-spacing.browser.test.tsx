import { describe, expect, it } from "../../utils/test-extend";
import { renderApp } from "../../utils/test-utils";

/**
 * Whether an element draws something itself: a fill, a border or a rule, or
 * leaf content such as text, an icon or an image. Layout wrappers draw nothing.
 */
const draws = (element: Element) => {
  const look = getComputedStyle(element);
  return (
    element.childElementCount === 0 ||
    look.backgroundColor !== "rgba(0, 0, 0, 0)" ||
    look.borderTopWidth !== "0px"
  );
};

/**
 * The space between the tabs and the first thing drawn under them: the
 * nearest top edge, below the tabs, of the drawn elements that follow them.
 */
const spaceUnderTabs = (tabs: Element) => {
  const tabsBottom = tabs.getBoundingClientRect().bottom;
  const tops = [...document.querySelectorAll("[data-rk='widget-container'] *")]
    .filter(
      (element) =>
        tabs.compareDocumentPosition(element) &
          Node.DOCUMENT_POSITION_FOLLOWING &&
        !element.contains(tabs) &&
        !tabs.contains(element) &&
        draws(element)
    )
    .map((element) => element.getBoundingClientRect())
    .filter((box) => box.height > 0 && box.width > 0)
    .map((box) => box.top)
    .filter((top) => top >= tabsBottom - 0.5);
  return Math.min(...tops) - tabsBottom;
};

describe("the space between the tabs and the page", () => {
  // The Dashboard Layout's frame already parts its header from the page by a
  // section gap; the Compact Layout's tabs sit inside the page column.
  it.for([
    { layout: "Compact", dashboardVariant: false, most: 16 },
    { layout: "Dashboard", dashboardVariant: true, most: 24 },
  ])(
    "parts the tabs from the page in the $layout Layout",
    async ({ dashboardVariant, most }) => {
      const app = await renderApp({
        skProps: { apiKey: import.meta.env.VITE_API_KEY, dashboardVariant },
      });
      await expect.element(app.getByRole("tablist")).toBeVisible();
      const tabs = app.container.querySelector("[data-rk='tabs-section']");
      if (tabs === null) throw new Error("The tabs section is missing.");

      await expect.poll(() => spaceUnderTabs(tabs)).toBeGreaterThanOrEqual(12);
      expect(spaceUnderTabs(tabs)).toBeLessThanOrEqual(most + 0.5);

      await app.unmount();
    }
  );
});
