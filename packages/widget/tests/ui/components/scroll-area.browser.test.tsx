import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

import { ThemeRoot } from "../../../src/ui/composition";
import { ScrollArea } from "../../../src/ui/index";
import { render } from "../../utils/test-utils";

const rows = Array.from({ length: 40 }, (_, index) => `Validator ${index + 1}`);

/**
 * Keyboard scrolling is the browser's default action for a trusted key, so
 * this presses PageDown through Playwright rather than a story's dispatched
 * event. The page itself is taller than the viewport, so a key that reached
 * it would scroll the window.
 */
describe("ScrollArea", () => {
  it("scrolls its own content, not the page, on PageDown", async () => {
    const screen = await render(
      <ThemeRoot
        appearance={{}}
        appearancePreset="default"
        callToActionSize="lg"
        colorScheme="light"
        gutter="md"
        surfaceStyle="filled"
        tabsIndicator="underline"
        portalContainer={undefined}
      >
        <div style={{ width: 280 }}>
          <ScrollArea label="Validators" maxHeight="sm">
            {rows.map((row) => (
              <p key={row}>{row}</p>
            ))}
          </ScrollArea>
        </div>
        <div style={{ height: "300vh" }} />
      </ThemeRoot>
    );
    const region = screen.getByRole("region", { name: "Validators" });

    await userEvent.tab();
    await expect.element(region).toHaveFocus();
    const viewport = region.element();
    expect(viewport.scrollTop).toBe(0);

    await userEvent.keyboard("{PageDown}");

    await expect.poll(() => viewport.scrollTop).toBeGreaterThan(0);
    expect(window.scrollY).toBe(0);
  });
});
