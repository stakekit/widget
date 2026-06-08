import { assignInlineVars } from "@vanilla-extract/dynamic";
import merge from "lodash.merge";
import { Just } from "purify-ts";
import type { PropsWithChildren } from "react";
import { useMemo } from "react";
import { vars } from "../styles/theme/contract.css";
import { rootSelector } from "../styles/theme/ids";
import { lightTheme } from "../styles/theme/themes";
import { getFineryThemeOverrides } from "../styles/theme/variant-overrides/finery";
import { portoThemeOverrides } from "../styles/theme/variant-overrides/porto";
import { utilaThemeOverrides } from "../styles/theme/variant-overrides/utila";
import { useSettings } from "./settings";

export const ThemeWrapper = ({ children }: PropsWithChildren) => {
  const { theme, variant } = useSettings();

  const finalTheme = useMemo(() => {
    const baseTheme = merge(structuredClone(lightTheme), theme);

    const overrides = Just(variant)
      .map((v) => {
        if (v === "utila") {
          return utilaThemeOverrides;
        }

        if (v === "finery") {
          return getFineryThemeOverrides(baseTheme);
        }

        if (v === "porto") {
          return portoThemeOverrides;
        }

        return {};
      })
      .unsafeCoerce();

    return merge(structuredClone(lightTheme), theme, overrides);
  }, [theme, variant]);

  return (
    <>
      <style
        // biome-ignore lint: false
        dangerouslySetInnerHTML={{
          __html: `${rootSelector} {${assignInlineVars(vars, finalTheme)}}`,
        }}
      />
      {children}
    </>
  );
};
