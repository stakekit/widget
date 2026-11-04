import type { ComponentProps } from "react";
import { describe, expect, it, onTestFinished } from "vitest";
import {
  type ColorScheme,
  type PresentationSettings,
  resolveColorRoles,
  ThemeRoot,
} from "../../../src/ui/composition";
import { Box, Button, Card, Modal, Text } from "../../../src/ui/index";
import { render } from "../../utils/test-utils";

const backgroundOf = (element: Element) =>
  getComputedStyle(element).backgroundColor;

/** A `#rrggbb` color as the browser reports it. */
const hexToRgb = (hex: string) => {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};
const presentation: PresentationSettings = {
  callToActionSize: "lg",
  gutter: "md",
  surfaceStyle: "filled",
  tabsIndicator: "underline",
};

type ThemeRootProps = ComponentProps<typeof ThemeRoot>;

const themeRootProps = (
  overrides: Partial<ThemeRootProps> = {}
): ThemeRootProps => ({
  appearance: {},
  appearancePreset: "default",
  colorScheme: "light",
  portalContainer: undefined,
  ...presentation,
  ...overrides,
});

const hostPortalContainer = () => {
  const portalContainer = document.createElement("div");
  document.body.append(portalContainer);
  onTestFinished(() => portalContainer.remove());
  return portalContainer;
};

/**
 * Renders a Button inside the Widget root and one in a Modal, which portals
 * into the host's container, and reads both.
 */
const renderInScheme = async (colorScheme: ColorScheme) => {
  const portalContainer = hostPortalContainer();

  const screen = await render(
    <ThemeRoot {...themeRootProps({ colorScheme, portalContainer })}>
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

  it("sizes the call-to-action for the requested presentation", async () => {
    const screen = await render(
      <>
        <ThemeRoot {...themeRootProps({ callToActionSize: "lg" })}>
          <Button size="cta">Large</Button>
        </ThemeRoot>
        <ThemeRoot {...themeRootProps({ callToActionSize: "md" })}>
          <Button size="cta">Medium</Button>
        </ThemeRoot>
      </>
    );

    const heightOf = (name: string) =>
      getComputedStyle(screen.getByRole("button", { name }).element()).height;

    expect(heightOf("Large")).toBe("48px");
    expect(heightOf("Medium")).toBe("40px");
  });

  it("spaces the gutter for the requested presentation", async () => {
    const screen = await render(
      <>
        <ThemeRoot {...themeRootProps({ gutter: "md" })}>
          <Box paddingInline="gutter">
            <Text>Narrow</Text>
          </Box>
        </ThemeRoot>
        <ThemeRoot {...themeRootProps({ gutter: "lg" })}>
          <Box paddingInline="gutter">
            <Text>Wide</Text>
          </Box>
        </ThemeRoot>
      </>
    );

    const gutterOf = (text: string) => {
      const box = screen.getByText(text).element().parentElement;
      return box ? getComputedStyle(box).paddingInlineStart : undefined;
    };

    expect(gutterOf("Narrow")).toBe("16px");
    expect(gutterOf("Wide")).toBe("20px");
  });

  it("carries the surface style and tabs indicator into the host's portal container", async () => {
    const portalContainer = hostPortalContainer();

    const screen = await render(
      <ThemeRoot
        {...themeRootProps({
          portalContainer,
          surfaceStyle: "elevated",
          tabsIndicator: "pill",
        })}
      >
        <Modal open title="Confirm" closeLabel="Close">
          <Card>
            <Text>Elevated</Text>
          </Card>
        </Modal>
      </ThemeRoot>
    );

    await expect.element(screen.getByText("Elevated")).toBeVisible();
    const portal = portalContainer.querySelector("[data-sk-portal]");
    const card = screen.getByText("Elevated").element().parentElement;

    expect(portal?.getAttribute("data-sk-surface-style")).toBe("elevated");
    expect(portal?.getAttribute("data-sk-tabs-indicator")).toBe("pill");
    expect(card ? getComputedStyle(card).boxShadow : "none").not.toBe("none");
  });

  it("keeps filled cards flat under the filled surface style", async () => {
    const screen = await render(
      <ThemeRoot {...themeRootProps({ surfaceStyle: "filled" })}>
        <Card>
          <Text>Filled</Text>
        </Card>
      </ThemeRoot>
    );

    const card = screen.getByText("Filled").element().parentElement;

    expect(card ? getComputedStyle(card).boxShadow : undefined).toBe("none");
  });

  it("presents a preset's fixed color scheme whatever the request", async () => {
    const screen = await render(
      <>
        <ThemeRoot
          {...themeRootProps({
            appearancePreset: "porto",
            colorScheme: "light",
          })}
        >
          <Card>
            <Text>Porto</Text>
          </Card>
        </ThemeRoot>
        <ThemeRoot
          {...themeRootProps({
            appearancePreset: "utila",
            colorScheme: "dark",
          })}
        >
          <Card>
            <Text>Utila</Text>
          </Card>
        </ThemeRoot>
      </>
    );

    // The Card's own colors: its surface, and the text role it sets.
    const read = (text: string) => {
      const card = screen.getByText(text).element().parentElement;
      if (!card) throw new Error(`No card around ${text}`);
      return getComputedStyle(card);
    };
    const porto = resolveColorRoles("light", "porto");
    const utila = resolveColorRoles("dark", "utila");

    expect(read("Porto").colorScheme).toBe("dark");
    expect(read("Utila").colorScheme).toBe("light");
    // Porto's palette sits over every dark role, not the light defaults.
    expect(read("Porto").backgroundColor).toBe(hexToRgb(porto.surface));
    expect(read("Porto").color).toBe(hexToRgb(porto.text));
    expect(read("Utila").backgroundColor).toBe(hexToRgb(utila.surface));
    expect(read("Utila").color).toBe(hexToRgb(utila.text));
  });
});
