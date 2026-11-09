import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import { ThemeRoot } from "../../../src/ui/composition";
import { Modal, Text } from "../../../src/ui/index";
import { render } from "../../utils/test-utils";

const rows = Array.from({ length: 40 }, (_, index) => `Paragraph ${index + 1}`);

const renderModal = (children: ReactNode) =>
  render(
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
      <Modal open title="Terms" closeLabel="Close" bodyTestId="modal-body">
        {children}
      </Modal>
    </ThemeRoot>
  );

/**
 * Keyboard scrolling is the browser's default action for a trusted key, so
 * these press keys through Playwright rather than a story's dispatched event.
 */
describe("Modal", () => {
  it("lets Tab reach a text-only body that overflows, and keys scroll it", async () => {
    await renderModal(rows.map((row) => <Text key={row}>{row}</Text>));
    const body = page.getByRole("region", { name: "Terms" });
    await expect.element(body).toHaveAttribute("tabindex", "0");
    await expect
      .element(page.getByRole("button", { name: "Close" }))
      .toHaveFocus();

    await userEvent.tab();
    await expect.element(body).toHaveFocus();
    const viewport = body.element();
    expect(viewport.scrollTop).toBe(0);

    await userEvent.keyboard("{PageDown}");
    await expect.poll(() => viewport.scrollTop).toBeGreaterThan(0);
    const afterPageDown = viewport.scrollTop;
    await userEvent.keyboard("{ArrowDown}");
    await expect.poll(() => viewport.scrollTop).toBeGreaterThan(afterPageDown);
  });

  it("takes no focus while a text-only body fits", async () => {
    await renderModal(<Text>Short terms.</Text>);
    await expect.element(page.getByText("Short terms.")).toBeVisible();
    expect(page.getByTestId("modal-body").element()).not.toHaveAttribute(
      "tabindex"
    );
  });
});
