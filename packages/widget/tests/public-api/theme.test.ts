import { describe, expect, expectTypeOf, it } from "vitest";
import type { SKTheme } from "../../src/public-api/theme";
import { decodeTheme } from "../../src/public-api/theme";

const staleHostTheme = (input: unknown) => input as SKTheme;

describe("public theme contract", () => {
  it("types supported widget and ConnectKit tokens", () => {
    const theme = {
      color: {
        accent: "#4A60FF",
        connectKit: {
          modalBackground: "#fff",
        },
      },
      borderRadius: {
        connectKit: {
          modal: "12px",
        },
      },
    } satisfies SKTheme;

    expectTypeOf(theme).toMatchTypeOf<SKTheme>();
  });

  it("rejects removed tokens at compile time", () => {
    const theme = {
      color: {
        // @ts-expect-error removed tokens are not part of the public contract
        positionsSectionBackgroundColor: "#fff",
      },
    } satisfies SKTheme;

    expect(theme.color.positionsSectionBackgroundColor).toBe("#fff");
  });

  it("silently strips unknown tokens for stale hosts", () => {
    expect(
      decodeTheme(
        staleHostTheme({
          color: {
            accent: "#4A60FF",
            positionsSectionBackgroundColor: "#fff",
          },
        })
      )
    ).toEqual({
      theme: {
        color: {
          accent: "#4A60FF",
        },
      },
      warnings: [],
    });
  });

  it("omits invalid leaves while retaining valid sibling tokens", () => {
    expect(
      decodeTheme(
        staleHostTheme({
          color: {
            accent: 42,
            background: "#fff",
          },
        })
      )
    ).toEqual({
      theme: {
        color: {
          background: "#fff",
        },
      },
      warnings: ["invalid-theme-token"],
    });
  });

  it("rejects a non-object theme without failing configuration", () => {
    expect(decodeTheme(staleHostTheme(42))).toEqual({
      theme: undefined,
      warnings: ["invalid-theme-root"],
    });
  });
});
