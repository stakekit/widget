import { assignInlineVars } from "@vanilla-extract/dynamic";
import merge from "lodash.merge";
import { Just } from "purify-ts";
import type { PropsWithChildren } from "react";
import { useMemo } from "react";
import { vars } from "../styles/theme/contract.css";
import { rootSelector } from "../styles/theme/ids";
import { darkTheme, lightTheme } from "../styles/theme/themes";
import { fineryThemeOverrides } from "../styles/theme/variant-overrides/finery";
import { utilaThemeOverrides } from "../styles/theme/variant-overrides/utila";
import type { RecursivePartial } from "../types/utils";
import { useSettings } from "./settings";

export type ThemeWrapperTheme =
  | RecursivePartial<typeof lightTheme>
  | {
      lightMode?: RecursivePartial<typeof lightTheme>;
      darkMode?: RecursivePartial<typeof darkTheme>;
    };

export const ThemeWrapper = ({ children }: PropsWithChildren) => {
  const { theme = { lightMode: lightTheme }, variant } = useSettings();

  const finalLightTheme = useMemo(
    () =>
      Just(variant)
        .map((v) => {
          if (v === "utila") {
            return utilaThemeOverrides;
          }

          if (v === "finery") {
            return fineryThemeOverrides;
          }

          return {};
        })
        .map((overrides) => {
          if ("lightMode" in theme) {
            return merge(
              structuredClone(lightTheme),
              theme.lightMode,
              overrides
            );
          }

          if (theme) {
            return merge(structuredClone(lightTheme), theme, overrides);
          }

          return lightTheme;
        })
        .unsafeCoerce(),
    [theme, variant]
  );

  const finalDarkTheme = useMemo(
    () =>
      "darkMode" in theme
        ? merge(structuredClone(darkTheme), theme.darkMode)
        : null,
    [theme]
  );

  return (
    <>
      <style
        // biome-ignore lint: false
        dangerouslySetInnerHTML={{
          __html: [
            finalLightTheme
              ? `${rootSelector} {${assignInlineVars(vars, finalLightTheme)}}`
              : null,

            finalDarkTheme
              ? `@media (prefers-color-scheme: dark) { ${rootSelector} {${assignInlineVars(
                  vars,
                  finalDarkTheme
                )}} }`
              : null,
          ].join(""),
        }}
      />
      {children}
    </>
  );
};
