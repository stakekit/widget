import { vars } from "./contract.css";

/** Theme surface tinted with a status colour; adapts to light/dark/variant themes. */
export const statusTint = (
  color: string,
  surface: string = vars.color.background,
  percent = 16
) => `color-mix(in oklab, ${color} ${percent}%, ${surface})`;

/** Status colour pulled toward the theme text colour so it reads on a tint in both light and dark themes. */
export const statusInk = (color: string) =>
  `color-mix(in oklab, ${color} 45%, ${vars.color.text})`;
