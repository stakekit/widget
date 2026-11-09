import { afterEach } from "vitest";
import { cdp } from "vitest/browser";

import { darkTheme, lightTheme } from "../../../src/index.package";
import { describe, expect, it } from "../../utils/test-extend";
import {
  type RenderResult,
  renderApp,
  rerenderApp,
} from "../../utils/test-utils";

// The Earn call-to-action is a Design System primary button: it fills with
// `accent` and outlines with `focusRing`, whose defaults differ by scheme.
const lightFocusRing = "rgb(74, 96, 255)";
const darkFocusRing = "rgb(140, 155, 255)";
const lightAccent = "rgb(74, 96, 255)";
const darkAccent = "rgb(76, 98, 255)";

const emulateColorScheme = (value: "light" | "dark" | "") =>
  cdp().send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-color-scheme", value }],
  });

const earnCallToAction = async (app: RenderResult) => {
  const cta = app.getByRole("button", { name: "Connect wallet" });
  // Disabled, it sits on the surface; enabled, it fills with the accent.
  await expect.element(cta).toBeEnabled();
  const element = cta.element();
  // Its colors transition once it becomes enabled.
  await Promise.all(element.getAnimations().map((motion) => motion.finished));
  return element;
};

const colors = (element: Element) => {
  const style = getComputedStyle(element);
  return { background: style.backgroundColor, focusRing: style.outlineColor };
};

describe("Host appearance", () => {
  afterEach(async () => {
    await emulateColorScheme("");
  });

  it("renders the light default without a theme or appearance", async () => {
    const app = await renderApp();

    expect(colors(await earnCallToAction(app))).toEqual({
      background: lightAccent,
      focusRing: lightFocusRing,
    });

    await app.unmount();
  });

  it("gives an unchanged legacy darkTheme the new dark default", async () => {
    const app = await renderApp({
      skProps: { apiKey: import.meta.env.VITE_API_KEY, theme: darkTheme },
    });

    // The legacy dark accent (#AB95FF) is a default, so it no longer applies.
    expect(colors(await earnCallToAction(app))).toEqual({
      background: darkAccent,
      focusRing: darkFocusRing,
    });

    await app.unmount();
  });

  it("colors the Earn call-to-action with a customized legacy primaryButtonBackground", async () => {
    const app = await renderApp({
      skProps: {
        apiKey: import.meta.env.VITE_API_KEY,
        theme: {
          ...lightTheme,
          color: { ...lightTheme.color, primaryButtonBackground: "#FF5500" },
        },
      },
    });

    expect(colors(await earnCallToAction(app)).background).toBe(
      "rgb(255, 85, 0)"
    );

    await app.unmount();
  });

  it("lets an appearance accent override a legacy one", async () => {
    const app = await renderApp({
      skProps: {
        apiKey: import.meta.env.VITE_API_KEY,
        appearance: { colors: { light: { accent: "#0E7C66" } } },
        theme: { color: { primaryButtonBackground: "#FF5500" } },
      },
    });

    expect(colors(await earnCallToAction(app))).toEqual({
      background: "rgb(14, 124, 102)",
      // The focus ring follows a host accent in light.
      focusRing: "rgb(14, 124, 102)",
    });

    await app.unmount();
  });

  it("follows an emulated operating-system preference change without a remount", async () => {
    await emulateColorScheme("light");
    const app = await renderApp({
      skProps: {
        apiKey: import.meta.env.VITE_API_KEY,
        appearance: { colorScheme: "system" },
      },
    });
    const cta = await earnCallToAction(app);

    expect(colors(cta).focusRing).toBe(lightFocusRing);

    await emulateColorScheme("dark");
    await expect.poll(() => colors(cta).focusRing).toBe(darkFocusRing);

    await emulateColorScheme("light");
    await expect.poll(() => colors(cta).focusRing).toBe(lightFocusRing);
    expect(cta.isConnected).toBe(true);

    await app.unmount();
  });

  it("re-themes a mounted Widget when appearance changes", async () => {
    const app = await renderApp({
      skProps: {
        apiKey: import.meta.env.VITE_API_KEY,
        appearance: { colors: { light: { accent: "#0E7C66" } } },
      },
    });
    const cta = await earnCallToAction(app);

    expect(colors(cta).background).toBe("rgb(14, 124, 102)");

    await rerenderApp(app, {
      skProps: {
        apiKey: import.meta.env.VITE_API_KEY,
        appearance: {
          colorScheme: "dark",
          colors: { dark: { accent: "#7C3AED" } },
        },
      },
    });

    await expect.poll(() => colors(cta).background).toBe("rgb(124, 58, 237)");
    expect(cta.isConnected).toBe(true);

    await app.unmount();
  });
});
