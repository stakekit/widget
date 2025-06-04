import { vars } from "@sk-widget/styles/theme/contract.css";
import { rootSelector } from "@sk-widget/styles/theme/ids";
import { utilaLightThemeOverrides } from "@sk-widget/styles/theme/variant-overrides";
import type { RecursivePartial } from "@sk-widget/types/utils";
import { assignInlineVars } from "@vanilla-extract/dynamic";
import merge from "lodash.merge";
import { Just } from "purify-ts";
import type { PropsWithChildren } from "react";
import { useMemo } from "react";
import { darkTheme, lightTheme } from "../styles/theme/themes";
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
        .map((v) => (v === "utila" ? utilaLightThemeOverrides : {}))
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
        // biome-ignore lint/security/noDangerouslySetInnerHtml: <explanation>
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
