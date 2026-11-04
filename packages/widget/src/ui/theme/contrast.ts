type Rgb = readonly [red: number, green: number, blue: number];

const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const channel = String.raw`\s*(\d{1,3}(?:\.\d+)?)\s*`;
// `rgb(r g b)`, `rgb(r, g, b)` and their `rgba` forms with a full alpha.
const rgb = new RegExp(
  String.raw`^rgba?\(${channel}[,\s]${channel}[,\s]${channel}(?:[,/]\s*(1|1\.0+|100%)\s*)?\)$`,
  "i"
);

const parseHex = (digits: string): Rgb => {
  const full =
    digits.length === 3
      ? [...digits].map((digit) => `${digit}${digit}`).join("")
      : digits;
  const n = Number.parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/**
 * An opaque `#rgb`, `#rrggbb` or `rgb()` color's sRGB channels; `undefined`
 * for any other CSS color, whose painted value only the browser knows.
 */
const parseOpaqueColor = (value: string): Rgb | undefined => {
  const trimmed = value.trim();
  const hexDigits = hex.exec(trimmed)?.[1];
  if (hexDigits !== undefined) return parseHex(hexDigits);

  const match = rgb.exec(trimmed);
  if (!match?.[1] || !match[2] || !match[3]) return undefined;
  const channels: Rgb = [Number(match[1]), Number(match[2]), Number(match[3])];
  return channels.every((value) => value <= 255) ? channels : undefined;
};

// WCAG relative luminance: each sRGB channel linearized, then weighted.
const linear = (value: number) => {
  const s = value / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

const luminance = ([red, green, blue]: Rgb) =>
  0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);

/**
 * The WCAG contrast ratio of two opaque colors, from 1 to 21; `undefined`
 * when either is not an opaque hex or `rgb()` color.
 */
export const contrastRatio = (
  first: string,
  second: string
): number | undefined => {
  const a = parseOpaqueColor(first);
  const b = parseOpaqueColor(second);
  if (a === undefined || b === undefined) return undefined;
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

/**
 * Of two colors, the one with the higher WCAG contrast on `background`;
 * `first` when any of the three cannot be measured.
 */
export const mostContrasting = (
  background: string,
  first: string,
  second: string
): string => {
  const firstRatio = contrastRatio(first, background);
  const secondRatio = contrastRatio(second, background);
  if (firstRatio === undefined || secondRatio === undefined) return first;
  return secondRatio > firstRatio ? second : first;
};
