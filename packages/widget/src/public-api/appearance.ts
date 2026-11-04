/** A semantic color the Widget's components read. */
export type SKColorRole =
  | "background"
  | "surface"
  | "surfaceHover"
  | "surfaceRaised"
  | "border"
  | "borderStrong"
  | "text"
  | "textMuted"
  | "textSubtle"
  | "accent"
  | "accentHover"
  | "onAccent"
  | "accentSoft"
  | "accentText"
  | "success"
  | "successSoft"
  | "warning"
  | "warningSoft"
  | "danger"
  | "dangerSoft"
  | "info"
  | "infoSoft"
  | "focusRing"
  | "scrim";

/**
 * How the Widget looks. Every value is a CSS value. Setting `accent` alone
 * also adjusts `accentHover`, `accentSoft`, `accentText`, `focusRing`, `info`
 * and `infoSoft`; setting `success`, `warning` or `danger` adjusts its soft
 * tint. A role set explicitly is used as given. Changes apply live.
 */
export interface SKAppearance {
  /** Defaults to `"light"`. `"system"` follows the operating-system preference. */
  readonly colorScheme?: "light" | "dark" | "system";
  /** Color Role values per color scheme. */
  readonly colors?: {
    readonly light?: Partial<Record<SKColorRole, string>>;
    readonly dark?: Partial<Record<SKColorRole, string>>;
  };
  readonly radius?: Partial<
    Record<"badge" | "control" | "card" | "overlay" | "shell", string>
  >;
  readonly controlHeight?: Partial<Record<"sm" | "md" | "lg", string>>;
  readonly font?: Partial<Record<"sans" | "mono", string>>;
  readonly fontWeight?: Partial<
    Record<"regular" | "medium" | "semibold", string>
  >;
}
