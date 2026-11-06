import * as stylex from "@stylexjs/stylex";

const REDUCED_MOTION = "@media (prefers-reduced-motion: reduce)";

/** Durations, the one easing and press feedback; none move under reduced motion. */
export const motion = stylex.defineVars({
  fast: { default: "120ms", [REDUCED_MOTION]: "0ms" },
  base: { default: "200ms", [REDUCED_MOTION]: "0ms" },
  slow: { default: "320ms", [REDUCED_MOTION]: "0ms" },
  // One turn of a loading spinner; 0ms stops it.
  spin: { default: "800ms", [REDUCED_MOTION]: "0ms" },
  // One breath of a loading skeleton; 0ms holds it still.
  pulse: { default: "1600ms", [REDUCED_MOTION]: "0ms" },
  // One breath of a signature's halo, slower than a skeleton's; 0ms holds it still.
  halo: { default: "2400ms", [REDUCED_MOTION]: "0ms" },
  // Starts a second halo half a breath in, so the ripples alternate.
  haloEcho: { default: "-1200ms", [REDUCED_MOTION]: "0ms" },
  easing: "cubic-bezier(0.2, 0, 0, 1)",
  // Constant speed, for motion that loops, such as a spinner.
  linear: "linear",
  press: { default: "scale(0.98)", [REDUCED_MOTION]: "none" },
});
