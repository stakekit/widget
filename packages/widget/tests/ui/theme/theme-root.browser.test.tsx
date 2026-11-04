import { createPortal } from "react-dom";
import { describe, expect, it } from "vitest";
import { ThemeRoot } from "../../../src/ui/composition";
import { Button } from "../../../src/ui/index";
import { render } from "../../utils/test-utils";

const backgroundOf = (element: Element) =>
  getComputedStyle(element).backgroundColor;

describe("ThemeRoot", () => {
  it.each([
    { colorScheme: "light", surface: "rgb(244, 244, 246)" },
    { colorScheme: "dark", surface: "rgb(32, 32, 36)" },
  ] as const)(
    "themes the Widget root and the portal container $colorScheme",
    async ({ colorScheme, surface }) => {
      const portalContainer = document.createElement("div");
      document.body.append(portalContainer);

      const screen = await render(
        <ThemeRoot
          callToActionSize="lg"
          colorScheme={colorScheme}
          portalContainer={portalContainer}
        >
          <Button>Inside</Button>
          {createPortal(<Button>Portaled</Button>, portalContainer)}
        </ThemeRoot>
      );
      const inside = screen.getByRole("button", { name: "Inside" }).element();
      const portaled = screen
        .getByRole("button", { name: "Portaled" })
        .element();

      expect(backgroundOf(inside)).toBe(surface);
      expect(backgroundOf(portaled)).toBe(surface);
      expect(getComputedStyle(portalContainer).colorScheme).toBe(colorScheme);

      await screen.unmount();
      portalContainer.remove();
    }
  );

  it("sizes the call-to-action for the Layout's presentation", async () => {
    const screen = await render(
      <>
        <ThemeRoot
          callToActionSize="lg"
          colorScheme="light"
          portalContainer={undefined}
        >
          <Button size="cta">Large</Button>
        </ThemeRoot>
        <ThemeRoot
          callToActionSize="md"
          colorScheme="light"
          portalContainer={undefined}
        >
          <Button size="cta">Medium</Button>
        </ThemeRoot>
      </>
    );

    const heightOf = (name: string) =>
      getComputedStyle(screen.getByRole("button", { name }).element()).height;

    expect(heightOf("Large")).toBe("48px");
    expect(heightOf("Medium")).toBe("40px");
  });
});
