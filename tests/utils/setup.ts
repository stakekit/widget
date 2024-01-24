import { vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { configure } from "@testing-library/react";
import ResizeObserver from "resize-observer-polyfill";
import { MotionGlobalConfig } from "framer-motion";

MotionGlobalConfig.skipAnimations = true;

global.ResizeObserver = ResizeObserver;

vi.setConfig({ testTimeout: 10000 });
configure({ asyncUtilTimeout: 10000 });

if (typeof window !== "undefined") {
  const originalConsoleError = console.error;
  const originalConsoleLog = console.log;

  console.error = (message, ...optionalParams) => {
    // JSDOM warning about CSS parsing @layer rules
    if (
      message.name === "CanceledError" ||
      message.constructor?.name === "CancelledError" ||
      (typeof message === "string" &&
        message.includes("Could not parse CSS stylesheet"))
    ) {
      return;
    }
    originalConsoleError(message, ...optionalParams);
  };

  console.log = (message, ...optionalParams) => {
    // JSDOM warning about CSS parsing @layer rules
    if (
      message.name === "CanceledError" ||
      message.constructor?.name === "CancelledError" ||
      (typeof message === "string" && message.includes("CancelledError"))
    ) {
      return;
    }
    originalConsoleLog(message, ...optionalParams);
  };

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  Object.defineProperty(window, "scrollTo", {
    writable: false,
    value: vi.fn(),
  });
}
