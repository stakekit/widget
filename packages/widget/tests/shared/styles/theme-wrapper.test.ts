import { describe, expect, it } from "vitest";
import { getThemeOverrides } from "../../../src/app/composition/providers/theme-wrapper";
import { darkTheme, lightTheme } from "../../../src/shared/styles/theme/themes";
import {
  fineryDarkPalette,
  fineryLightPalette,
} from "../../../src/shared/styles/theme/variant-overrides/palettes";
import { portoThemeOverrides } from "../../../src/shared/styles/theme/variant-overrides/porto";
import { utilaThemeOverrides } from "../../../src/shared/styles/theme/variant-overrides/utila";

describe("getThemeOverrides", () => {
  it("keeps the default variant unthemed", () => {
    expect(
      getThemeOverrides({ colorScheme: "light", variant: "default" })
    ).toEqual({});
  });

  it("keeps explicit Porto variant overrides", () => {
    expect(getThemeOverrides({ colorScheme: "dark", variant: "porto" })).toBe(
      portoThemeOverrides
    );
  });

  it("keeps the explicit Utila variant override", () => {
    expect(getThemeOverrides({ colorScheme: "light", variant: "utila" })).toBe(
      utilaThemeOverrides
    );
  });

  it("picks Finery's palette from the resolved color scheme", () => {
    expect(
      getThemeOverrides({ colorScheme: "light", variant: "finery" }).color
        ?.background
    ).toBe(fineryLightPalette.greyOne);
    expect(
      getThemeOverrides({ colorScheme: "dark", variant: "finery" }).color
        ?.background
    ).toBe(fineryDarkPalette.greyOne);
  });
});

describe("base themes", () => {
  it("uses the Utila palette for light defaults", () => {
    expect(lightTheme.color.primaryButtonBackground).toBe("#4A60FF");
    expect(lightTheme.color.summaryItemBackground).toBe("#f5f5f6");
    expect(lightTheme.color.tabBorder).toBe("#e4e4e7");
  });

  it("uses the Porto palette for dark defaults", () => {
    expect(darkTheme.color.primary).toBe("#171717");
    expect(darkTheme.color.primaryButtonBackground).toBe("#AB95FF");
    expect(darkTheme.color.summaryItemBackground).toBe("#282828");
  });
});
