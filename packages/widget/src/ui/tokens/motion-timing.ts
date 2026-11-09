/**
 * The motion tokens (`motion.stylex.ts`) in the units `motion` takes: seconds
 * and cubic-bezier points. A browser test holds `fast`, `base`, `slow` and
 * the easing to the tokens. `count` is how long an animated number takes to
 * reach a new value; `reveal`, how long the Widget's frame takes to grow open
 * on mount; `pageSettle`, how long the frame's height must hold still after a
 * page change before the frame stops easing to it, which covers the old
 * page's exit and the new page's first layout; `pageShrinkDelay`, how long a
 * smaller height must hold during a page change before the frame shrinks to
 * it, so a moment between pages does not dip it. Parts that animate through
 * `motion` read reduced motion themselves and then skip the animation.
 */
export const motionSeconds = {
  fast: 0.12,
  base: 0.2,
  slow: 0.32,
  count: 0.8,
  reveal: 0.6,
  pageSettle: 0.6,
  pageShrinkDelay: 0.2,
} as const;

export const motionEasing = [0.2, 0, 0, 1] as const;

/**
 * How far a page moves as it enters, and how much it blurs and shrinks as it
 * leaves, in pixels and as a scale.
 */
export const pageMotion = {
  rise: 12,
  blur: "blur(8px)",
  shrink: 0.96,
} as const;

/**
 * How content enters the Widget: on its first mount it waits for the frame
 * to open and drops in from further up, slowly; later it drops in briefly.
 * Seconds and pixels.
 */
export const entranceMotion = {
  firstDelay: 0.8,
  firstDuration: 1,
  firstRise: 40,
  laterDuration: 0.3,
  laterRise: 10,
} as const;
