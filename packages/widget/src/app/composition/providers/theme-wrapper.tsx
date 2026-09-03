import { assignInlineVars } from "@vanilla-extract/dynamic";
import type { PropsWithChildren } from "react";
import { useMemo } from "react";
import { useWidgetConfig } from "../../../features/widget-configuration/index";
import type { WidgetConfig } from "../../../services/config/widget-config-model";
import { mergeDeep } from "../../../shared/effect/merge-deep";
import { vars } from "../../../shared/styles/theme/contract.css";
import { rootSelector } from "../../../shared/styles/theme/ids";
import { lightTheme } from "../../../shared/styles/theme/themes";
import { getFineryThemeOverrides } from "../../../shared/styles/theme/variant-overrides/finery";
import { portoThemeOverrides } from "../../../shared/styles/theme/variant-overrides/porto";
import { utilaThemeOverrides } from "../../../shared/styles/theme/variant-overrides/utila";
import type { RecursivePartial } from "../../../shared/types/utils";

export const getThemeOverrides = ({
  baseTheme,
  variant,
}: {
  baseTheme: typeof lightTheme;
  variant: WidgetConfig["variant"];
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
  const theme = useWidgetConfig("theme");
  const variant = useWidgetConfig("variant");

  const finalTheme = useMemo(() => {
    const baseTheme = mergeDeep(lightTheme, theme);
    const overrides = getThemeOverrides({
      baseTheme,
      variant,
    });

    return mergeDeep(lightTheme, theme, overrides);
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
