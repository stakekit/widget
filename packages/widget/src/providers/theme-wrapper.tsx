import { assignInlineVars } from "@vanilla-extract/dynamic";
import merge from "lodash.merge";
import type { PropsWithChildren } from "react";
import { useMemo } from "react";
import { vars } from "../styles/theme/contract.css";
import { rootSelector } from "../styles/theme/ids";
import { lightTheme } from "../styles/theme/themes";
import { getFineryThemeOverrides } from "../styles/theme/variant-overrides/finery";
import { portoThemeOverrides } from "../styles/theme/variant-overrides/porto";
import { utilaThemeOverrides } from "../styles/theme/variant-overrides/utila";
import type { RecursivePartial } from "../types/utils";
import { useSettings } from "./settings";
import type { SettingsContextType } from "./settings/types";

export const getThemeOverrides = ({
  baseTheme,
  variant,
}: {
  baseTheme: typeof lightTheme;
  variant: SettingsContextType["variant"];
}): RecursivePartial<typeof lightTheme> => {
  if (variant === "utila") {
    return utilaThemeOverrides;
  }

  if (variant === "finery") {
    return getFineryThemeOverrides(baseTheme);
  }

  if (variant === "porto") {
    return portoThemeOverrides;
  }

  return {};
};

export const ThemeWrapper = ({ children }: PropsWithChildren) => {
  const { theme, variant } = useSettings();

  const finalTheme = useMemo(() => {
    const baseTheme = merge(structuredClone(lightTheme), theme);
    const overrides = getThemeOverrides({
      baseTheme,
      variant,
    });

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
