import { rootSelector } from "@sk-widget/styles/theme/ids";
import { assignInlineVars } from "@vanilla-extract/dynamic";
import merge from "lodash.merge";
import type { PropsWithChildren } from "react";
import { useMemo } from "react";
import { vars } from "../styles";
import { darkTheme, lightTheme } from "../styles/theme/themes";
import type { RecursivePartial } from "../types";
import { useSettings } from "./settings";

export type ThemeWrapperTheme =
  | RecursivePartial<typeof lightTheme>
  | {
      lightMode?: RecursivePartial<typeof lightTheme>;
      darkMode?: RecursivePartial<typeof darkTheme>;
    };

export const ThemeWrapper = ({ children }: PropsWithChildren) => {
  const { theme = { lightMode: lightTheme } } = useSettings();

  const finalLightTheme = useMemo(
    () =>
      "lightMode" in theme
        ? merge(structuredClone(lightTheme), theme.lightMode)
        : theme
          ? merge(structuredClone(lightTheme), theme)
          : lightTheme,
    [theme]
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
