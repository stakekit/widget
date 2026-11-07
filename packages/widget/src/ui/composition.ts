/**
 * The Design System's composition interface, for application composition
 * only: the theme root that themes the Widget root and portal container, and
 * theme resolution for a color scheme and Appearance Preset, and the
 * Presentation Settings it applies.
 */
export {
  appearancePresets,
  presetColorScheme,
  resolveColorRoles,
} from "./theme/appearance-presets";
export type { ColorScheme } from "./theme/color-schemes";
export {
  type PresentationSettings,
  type SurfaceStyle,
  type TabsIndicator,
  ThemeRoot,
} from "./theme/theme-root";
export type { ColorRole } from "./tokens/color.stylex";
