import { assignInlineVars } from "@vanilla-extract/dynamic";
import { Predicate } from "effect";
import type { PropsWithChildren } from "react";
import { useWidgetConfig } from "../../../features/widget-configuration/index";
import type { WidgetConfig } from "../../../services/config/widget-config-model";
import { mergeDeep } from "../../../shared/effect/merge-deep";
import { vars } from "../../../shared/styles/theme/contract.css";
import { id, rootSelector } from "../../../shared/styles/theme/ids";
import { lightTheme } from "../../../shared/styles/theme/themes";
import {
  type FineryBaseTheme,
  getFineryThemeOverrides,
} from "../../../shared/styles/theme/variant-overrides/finery";
import { portoThemeOverrides } from "../../../shared/styles/theme/variant-overrides/porto";
import { utilaThemeOverrides } from "../../../shared/styles/theme/variant-overrides/utila";
import type { RecursivePartial } from "../../../shared/types/utils";

export const getThemeOverrides = ({
  baseTheme,
  variant,
}: {
  baseTheme: FineryBaseTheme;
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

/**
 * CSS variable assignments for a merged theme, read through the theme
 * contract: each contract leaf (a `var(--…)` reference) takes the merged value
 * at the same path. Values off the contract are not emitted.
 */
const themeVarEntries = (
  contract: unknown,
  tokens: unknown
): ReadonlyArray<readonly [string, string]> => {
  if (typeof contract === "string") {
    return typeof tokens === "string" ? [[contract, tokens]] : [];
  }
  if (!Predicate.isObject(contract) || !Predicate.isObject(tokens)) return [];

  return Object.entries(contract).flatMap(([key, node]) =>
    themeVarEntries(node, tokens[key])
  );
};

/** Theme variables for a host theme and variant, read from props. */
export const ThemeStyles = ({
  children,
  theme,
  variant,
}: PropsWithChildren<{
  readonly theme: WidgetConfig["theme"];
  readonly variant: WidgetConfig["variant"];
}>) => {
  const overrides = getThemeOverrides({
    baseTheme: {
      color: { primary: theme?.color?.primary ?? lightTheme.color.primary },
    },
    variant,
  });
  const finalTheme = mergeDeep(lightTheme, theme, overrides);
  const themeVars = Object.fromEntries(themeVarEntries(vars, finalTheme));

  return (
    <div data-rk={id}>
      <style
        // biome-ignore lint: false
        dangerouslySetInnerHTML={{
          __html: `${rootSelector} {${assignInlineVars(themeVars)}}`,
        }}
      />
      {children}
    </div>
  );
};

export const ThemeWrapper = ({ children }: PropsWithChildren) => {
  const theme = useWidgetConfig("theme");
  const variant = useWidgetConfig("variant");

  return (
    <ThemeStyles theme={theme} variant={variant}>
      {children}
    </ThemeStyles>
  );
};
