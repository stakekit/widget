import type {
  SettingsProps,
  SKHostVariant,
} from "../../../src/public-api/types";
import { legacyThemeDefaults } from "../../../src/services/config/legacy-theme-defaults";
import { widgetStorageKeys } from "../../../src/services/persistence/widget-persistence";
import { describe, expect, it } from "../../utils/test-extend";
import { type RenderResult, renderApp } from "../../utils/test-utils";

/** The host options these journeys vary; Zerion needs a chain modal too. */
type HostProps = Pick<SettingsProps, "appearance" | "layout" | "theme"> & {
  readonly variant?: Exclude<SKHostVariant, "zerion">;
};

const earnCallToAction = async (app: RenderResult) => {
  const cta = app.getByRole("button", { name: "Connect Wallet" });
  // Disabled, it sits on the surface; enabled, it fills with the accent.
  await expect.element(cta).toBeEnabled();
  const element = cta.element();
  // Its colors transition once it becomes enabled.
  await Promise.all(element.getAnimations().map((motion) => motion.finished));
  return element;
};

/**
 * The Earn call-to-action's look for a host. Utila hosts acknowledge the
 * terms of service first, whose dialog hides the page until then; the
 * acknowledgement persists, so each render starts without it.
 */
const renderEarnCallToAction = async (props: HostProps) => {
  localStorage.removeItem(widgetStorageKeys.tosAccepted);
  const app = await renderApp({
    skProps: { apiKey: import.meta.env.VITE_API_KEY, ...props },
  });
  if (props.variant === "utila") {
    await app
      .getByRole("checkbox", {
        name: "I have read and agree to the Terms of Use",
      })
      .click();
    await app.getByRole("button", { name: "I Accept" }).click();
  }
  const style = getComputedStyle(await earnCallToAction(app));
  const read = {
    background: style.backgroundColor,
    colorScheme: style.colorScheme,
    height: style.height,
    text: style.color,
  };

  await app.unmount();
  return read;
};

// Finery's brand teal in dark; in light it is darkened to mark a selected
// control at 3:1.
const fineryLightAccent = "rgb(17, 154, 136)";
const fineryDarkAccent = "rgb(22, 199, 176)";
const portoAccent = "rgb(171, 149, 255)";
const legacyAccent = "rgb(255, 85, 0)";
const hostAccent = "rgb(14, 124, 102)";
const darkText = "rgb(24, 24, 27)";
const whiteText = "rgb(255, 255, 255)";

describe("Host Profile Appearance Presets", () => {
  it("layers base scheme < preset < mapped legacy theme < appearance", async () => {
    const preset = await renderEarnCallToAction({ variant: "finery" });
    const legacy = await renderEarnCallToAction({
      theme: { color: { primaryButtonBackground: "#FF5500" } },
      variant: "finery",
    });
    const appearance = await renderEarnCallToAction({
      appearance: { colors: { light: { accent: "#0E7C66" } } },
      theme: { color: { primaryButtonBackground: "#FF5500" } },
      variant: "finery",
    });

    // Finery's teal takes dark text, which white fails on.
    expect(preset.background).toBe(fineryLightAccent);
    expect(preset.text).toBe(darkText);
    // A light host accent takes dark text (5.5:1; white is 3.2:1), a dark
    // one white.
    expect(legacy.background).toBe(legacyAccent);
    expect(legacy.text).toBe(darkText);
    expect(appearance.background).toBe(hostAccent);
    expect(appearance.text).toBe(whiteText);
  });

  it("keeps a legacy theme's colors under a preset that fixes another scheme", async () => {
    // A partial theme is inferred light; Porto presents dark.
    const porto = await renderEarnCallToAction({
      theme: { color: { primaryButtonBackground: "#FF5500" } },
      variant: "porto",
    });
    // A theme built on `darkTheme` is inferred dark; Utila presents light.
    const utila = await renderEarnCallToAction({
      theme: {
        ...legacyThemeDefaults.dark,
        color: {
          ...legacyThemeDefaults.dark.color,
          primaryButtonBackground: "#FF5500",
        },
      },
      variant: "utila",
    });

    expect(porto.colorScheme).toBe("dark");
    expect(porto.background).toBe(legacyAccent);
    expect(porto.text).toBe(darkText);
    expect(utila.colorScheme).toBe("light");
    expect(utila.background).toBe(legacyAccent);
    expect(utila.text).toBe(darkText);
  });

  it("picks Finery's palette from the requested color scheme", async () => {
    const dark = await renderEarnCallToAction({
      appearance: { colorScheme: "dark" },
      variant: "finery",
    });

    expect(dark.colorScheme).toBe("dark");
    expect(dark.background).toBe(fineryDarkAccent);
    expect(dark.text).toBe("rgb(18, 32, 36)");
  });

  it("fixes Porto to dark and Utila to light whatever the request", async () => {
    const porto = await renderEarnCallToAction({
      appearance: { colorScheme: "light" },
      variant: "porto",
    });
    const utila = await renderEarnCallToAction({
      appearance: { colorScheme: "dark" },
      variant: "utila",
    });

    expect(porto.colorScheme).toBe("dark");
    expect(porto.background).toBe(portoAccent);
    expect(porto.text).toBe("rgb(23, 23, 23)");
    expect(utila.colorScheme).toBe("light");
  });
});

describe("Earn call-to-action height", () => {
  it.each([
    ["the Compact Layout", { layout: "compact" }, "48px"],
    ["the Dashboard Layout", { layout: "dashboard" }, "40px"],
    ["Porto in the Compact Layout", { variant: "porto" }, "40px"],
    ["Utila in the Compact Layout", { variant: "utila" }, "40px"],
    ["Finery in the Compact Layout", { variant: "finery" }, "48px"],
  ] satisfies ReadonlyArray<readonly [string, HostProps, string]>)(
    "follows %s",
    async (_name, props, height) => {
      expect((await renderEarnCallToAction(props)).height).toBe(height);
    }
  );
});
