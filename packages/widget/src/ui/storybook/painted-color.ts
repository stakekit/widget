// A computed CSS color (which may be a resolved `color-mix`) as the sRGB
// channels a canvas paints it in, and whether it is opaque, so a play test
// compares colors as painted rather than as strings.
const paint = (cssColor: string) => {
  const context = document.createElement("canvas").getContext("2d");
  if (context === null) throw new Error("Expected a 2D canvas.");
  context.fillStyle = cssColor;
  context.fillRect(0, 0, 1, 1);
  const [red = 0, green = 0, blue = 0, alpha = 0] = context.getImageData(
    0,
    0,
    1,
    1
  ).data;
  return { channels: [red, green, blue], opaque: alpha === 255 };
};

// WCAG relative luminance of painted sRGB channels.
const luminance = (channels: ReadonlyArray<number>) => {
  const [red = 0, green = 0, blue = 0] = channels.map((channel) => {
    const s = channel / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
};

// The WCAG contrast ratio of two CSS colors as painted.
const paintedContrast = (first: string, second: string) => {
  const a = luminance(paint(first).channels);
  const b = luminance(paint(second).channels);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

/**
 * How a soft control (a tint under accent text) stands off the surface it
 * sits on, as painted: whether its fill differs from `surfaceColor`, and its
 * edge's width, opacity and contrast on it, which the contrast test holds at
 * 1.5:1 through `softControlTint.edge`.
 */
export const softControlSetOff = (control: Element, surfaceColor: string) => {
  const style = getComputedStyle(control);
  const fill = paint(style.backgroundColor).channels;
  const surface = paint(surfaceColor).channels;
  return {
    fillDiffers: fill.some((channel, index) => channel !== surface[index]),
    edgeWidth: style.borderTopWidth,
    edgeOpaque: paint(style.borderTopColor).opaque,
    edgeContrast: paintedContrast(style.borderTopColor, surfaceColor),
  };
};
