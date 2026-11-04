import { describe, expect, it, onTestFinished } from "vitest";
import { type ColorScheme, ThemeRoot } from "../../../src/ui/composition";
import { Button, Modal } from "../../../src/ui/index";
import { render } from "../../utils/test-utils";

const backgroundOf = (element: Element) =>
  getComputedStyle(element).backgroundColor;

/**
 * Renders a Button inside the Widget root and one in a Modal, which portals
 * into the host's container, and reads both.
 */
const renderInScheme = async (colorScheme: ColorScheme) => {
  const portalContainer = document.createElement("div");
  document.body.append(portalContainer);
  onTestFinished(() => portalContainer.remove());

  const screen = await render(
    <ThemeRoot
      appearance={{}}
      appearancePreset="default"
      callToActionSize="lg"
      colorScheme={colorScheme}
      portalContainer={portalContainer}
    >
      <Button>Inside</Button>
      <Modal open title="Confirm" closeLabel="Close">
        <Button>Portaled</Button>
      </Modal>
    </ThemeRoot>
  );
  // The open Modal hides the rest of the page from the accessibility tree.
  const inside = screen.getByText("Inside").element();
  const portaled = screen.getByRole("button", { name: "Portaled" });
  await expect.element(portaled).toBeVisible();
  const portaledElement = portaled.element();
  const read = {
    contained: portalContainer.contains(portaledElement),
    inside: backgroundOf(inside),
    portaled: backgroundOf(portaledElement),
    portaledScheme: getComputedStyle(portaledElement).colorScheme,
  };

  await screen.unmount();
  return read;
};

describe("ThemeRoot", () => {
  it("themes popups in the host's portal container as the Widget root", async () => {
    const light = await renderInScheme("light");
    const dark = await renderInScheme("dark");

    expect(light.contained).toBe(true);
    expect(light.portaled).toBe(light.inside);
    expect(light.portaledScheme).toBe("light");
    expect(dark.contained).toBe(true);
    expect(dark.portaled).toBe(dark.inside);
    expect(dark.portaledScheme).toBe("dark");
    expect(dark.inside).not.toBe(light.inside);
  });

  it("sizes the call-to-action for the Layout's presentation", async () => {
    const screen = await render(
      <>
        <ThemeRoot
          appearance={{}}
          appearancePreset="default"
          callToActionSize="lg"
          colorScheme="light"
          portalContainer={undefined}
        >
          <Button size="cta">Large</Button>
        </ThemeRoot>
        <ThemeRoot
          appearance={{}}
          appearancePreset="default"
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
