import { describe, expect, it } from "vitest";
import { getThemeOverrides } from "../../src/providers/theme-wrapper";
import { darkTheme, lightTheme } from "../../src/styles/theme/themes";
import { portoThemeOverrides } from "../../src/styles/theme/variant-overrides/porto";
import { utilaThemeOverrides } from "../../src/styles/theme/variant-overrides/utila";

describe("getThemeOverrides", () => {
  it("keeps the default variant unthemed", () => {
    expect(
      getThemeOverrides({
        baseTheme: lightTheme,
        variant: "default",
      })
    ).toEqual({});
  });

  it("keeps explicit Porto variant overrides", () => {
    expect(
      getThemeOverrides({
        baseTheme: lightTheme,
        variant: "porto",
      })
    ).toBe(portoThemeOverrides);
  });

  it("keeps the explicit Utila variant override", () => {
    expect(
      getThemeOverrides({
        baseTheme: lightTheme,
        variant: "utila",
      })
    ).toBe(utilaThemeOverrides);
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
