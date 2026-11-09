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
  const cta = app.getByRole("button", { name: "Connect wallet" });
  // Disabled, it sits on the surface; enabled, it fills with the accent.
  await expect.element(cta).toBeEnabled();
  const element = cta.element();
  // Its colors transition once it becomes enabled.
  await Promise.all(element.getAnimations().map((motion) => motion.finished));
  return element;
};

/** The nearest ancestor that paints a fill: the card a part sits in. */
const filledAncestor = (element: Element): Element => {
  const parent = element.parentElement;
  if (parent === null) throw new Error("No filled ancestor");
  return getComputedStyle(parent).backgroundColor === "rgba(0, 0, 0, 0)"
    ? filledAncestor(parent)
    : parent;
};

/**
 * The Earn page's look for a host: its call-to-action, the amount card and
 * the token trigger in it. Utila hosts acknowledge the terms of service
 * first, whose dialog hides the page until then; the acknowledgement
 * persists, so each render starts without it.
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
    await app.getByRole("button", { name: "I accept" }).click();
  }
  const style = getComputedStyle(await earnCallToAction(app));
  const trigger = app.getByTestId("select-token").element();
  const card = getComputedStyle(filledAncestor(trigger));
  await expect
    .element(app.getByTestId("estimated-reward__percent"))
    .toBeInTheDocument();
  // The yield card's section: its title, above or inside the card.
  const yieldSection = filledAncestor(
    app.getByTestId("estimated-reward__percent").element()
  ).parentElement;
  const read = {
    background: style.backgroundColor,
    card: {
      border: card.borderTopColor,
      radius: card.borderTopLeftRadius,
      shadow: card.boxShadow,
    },
    colorScheme: style.colorScheme,
    height: style.height,
    tabsIndicator: document
      .querySelector("[data-sk-root]")
      ?.getAttribute("data-sk-tabs-indicator"),
    text: style.color,
    triggerRadius: getComputedStyle(trigger).borderTopLeftRadius,
    triggerShadow: getComputedStyle(trigger).boxShadow,
    yieldTitled: Array.from(yieldSection?.querySelectorAll("*") ?? []).some(
      (element) =>
        element.childElementCount === 0 && element.textContent === "Earn"
    ),
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
// Finery's own dark `onAccent`; a host accent too light for white takes the
// light scheme's `text` instead.
const fineryOnAccent = "rgb(24, 24, 27)";
const darkText = "rgb(22, 23, 29)";
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
    expect(preset.text).toBe(fineryOnAccent);
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

  it("drops the host's colors for a requested scheme the preset does not present", async () => {
    const utila = await renderEarnCallToAction({
      appearance: { colorScheme: "dark" },
      variant: "utila",
    });
    const withDarkColors = await renderEarnCallToAction({
      appearance: {
        colorScheme: "dark",
        colors: { dark: { accent: "#7C3AED", background: "#101014" } },
      },
      variant: "utila",
    });

    expect(withDarkColors.colorScheme).toBe("light");
    expect(withDarkColors.background).toBe(utila.background);
    expect(withDarkColors.text).toBe(utila.text);
  });
});

const transparent = "rgba(0, 0, 0, 0)";

describe("Appearance Preset identities", () => {
  it("lifts Finery's cards on one level of shadow, with softer corners", async () => {
    const finery = await renderEarnCallToAction({ variant: "finery" });
    const standard = await renderEarnCallToAction({});

    expect(finery.card.shadow).not.toBe("none");
    expect(finery.card.border).toBe(transparent);
    // The card is raised, so the token trigger in it is not.
    expect(finery.triggerShadow).toBe("none");
    expect(finery.card.radius).toBe("20px");
    expect(finery.tabsIndicator).toBe("underline");
    expect(standard.card.shadow).toBe("none");
    expect(standard.triggerShadow).not.toBe("none");
    expect(standard.card.radius).toBe("16px");
    expect(standard.yieldTitled).toBe(true);
  });

  it("keeps Porto flat, edged and tight-cornered, with pill tabs", async () => {
    const porto = await renderEarnCallToAction({ variant: "porto" });

    expect(porto.card.shadow).toBe("none");
    // The amount card reads as an input, in Porto's strong edge.
    expect(porto.card.border).toBe("rgb(74, 74, 80)");
    expect(porto.card.radius).toBe("6px");
    // Raised parts are outlined, not shadowed.
    expect(porto.triggerShadow).toBe("rgb(74, 74, 80) 0px 0px 0px 1px");
    expect(porto.tabsIndicator).toBe("pill");
  });

  it("edges Utila's cards at 12px corners, with a flat token trigger, no Earn title and a 40px call to action", async () => {
    const utila = await renderEarnCallToAction({
      layout: "dashboard",
      variant: "utila",
    });

    expect(utila.card.shadow).toBe("none");
    // The amount card reads as an input, in Utila's `#C9CFFF` edge.
    expect(utila.card.border).toBe("rgb(201, 207, 255)");
    expect(utila.card.radius).toBe("12px");
    // The card's edge is the only one: the trigger in it is not ringed.
    expect(utila.triggerShadow).toBe("none");
    expect(utila.triggerRadius).toBe("12px");
    // As in Utila's own UI, the yield card goes untitled.
    expect(utila.yieldTitled).toBe(false);
    expect(utila.height).toBe("40px");
    expect(utila.tabsIndicator).toBe("tint");
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
