import { useMediaQuery } from "./use-media-query";

/**
 * Whether the user asks for reduced motion, kept current as the preference
 * changes. For parts animated through `motion`, whose own hook reads the
 * preference once; CSS transitions read it through the motion tokens.
 */
export const useReducedMotion = () =>
  useMediaQuery("(prefers-reduced-motion: reduce)");
