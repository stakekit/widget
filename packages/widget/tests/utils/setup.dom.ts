import { MotionGlobalConfig } from "motion/react";
import { failOnReactErrors } from "./fail-on-react-errors";

MotionGlobalConfig.skipAnimations = true;
failOnReactErrors();

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

// jsdom has no ResizeObserver; Design System parts such as AmountInput observe sizes.
if (globalThis.ResizeObserver === undefined) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// jsdom has no matchMedia; Design System parts read the reduced-motion and
// viewport queries through it. Nothing matches.
if (typeof window.matchMedia !== "function") {
  window.matchMedia = (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  });
}
