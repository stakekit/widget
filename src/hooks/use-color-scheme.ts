import { useLayoutEffect, useState } from "react";
import { MaybeWindow } from "../utils/maybe-window";

const getCurrentColorScheme = () =>
  MaybeWindow.map((w) => {
    const isDark = w.matchMedia("(prefers-color-scheme: dark)");
    const isLight = w.matchMedia("(prefers-color-scheme: light)");

    return isDark.matches
      ? "dark"
      : isLight.matches
        ? "light"
        : "no-preference";
  }).orDefault("no-preference");

export const usePrefersColorScheme = () => {
  const [preferredColorSchema, setPreferredColorSchema] = useState<{
    theme: "dark" | "light" | "no-preference";
    force: boolean;
  }>(() => {
    const scheme = getCurrentColorScheme();

    return { force: false, theme: scheme };
  });

  useLayoutEffect(() => {
    if (preferredColorSchema.force) return;

    const w = MaybeWindow.extractNullable();

    if (!w) return;

    const isDark = w.matchMedia("(prefers-color-scheme: dark)");
    const isLight = w.matchMedia("(prefers-color-scheme: light)");

    if (typeof isLight.addEventListener !== "function") return;

    const darkListener = ({ matches }: MediaQueryListEvent) => {
      matches && setPreferredColorSchema({ theme: "dark", force: false });
    };
    const lightListener = ({ matches }: MediaQueryListEvent) => {
      matches && setPreferredColorSchema({ theme: "light", force: false });
    };

    isDark.addEventListener("change", darkListener);
    isLight.addEventListener("change", lightListener);

    return () => {
      isDark.removeEventListener("change", darkListener);
      isLight.removeEventListener("change", lightListener);
    };
  }, [preferredColorSchema]);

  return preferredColorSchema.theme;
};
