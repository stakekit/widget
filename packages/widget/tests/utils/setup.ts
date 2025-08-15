import { afterAll, afterEach, beforeAll, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { MotionGlobalConfig } from "motion/react";
import ResizeObserver from "resize-observer-polyfill";
import { server } from "../mocks/server";

MotionGlobalConfig.skipAnimations = true;

global.ResizeObserver = ResizeObserver;

vi.setConfig({ testTimeout: 10000 });
configure({ asyncUtilTimeout: 10000 });

const originalConsoleError = console.error;
const originalConsoleLog = console.log;

const originalStdoutWrite = process.stdout.write.bind(process.stdout);
//@ts-expect-error
process.stdout.write = (chunk, encoding, callback) => {
  if (typeof chunk === "string" && chunk.includes("relay.walletconnect")) {
    return true;
  }

  return originalStdoutWrite(chunk, encoding, callback);
};

console.error = (message, ...optionalParams) => {
  // JSDOM warning about CSS parsing @layer rules
  if (
    message?.name === "CanceledError" ||
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
    message?.name === "CanceledError" ||
    message.constructor?.name === "CancelledError" ||
    (typeof message.message === "string" &&
      message.message.includes("Could not get enabled networks")) ||
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

class JSDOMCompatibleTextEncoder extends TextEncoder {
  encode(input: string) {
    if (typeof input !== "string") {
      throw new TypeError("`input` must be a string");
    }

    const decodedURI = decodeURIComponent(encodeURIComponent(input));
    const arr = new Uint8Array(decodedURI.length);
    const chars = decodedURI.split("");
    for (let i = 0; i < chars.length; i++) {
      arr[i] = decodedURI[i].charCodeAt(0);
    }
    return arr;
  }
}

// https://github.com/vitest-dev/vitest/issues/4043
Object.defineProperty(global, "TextEncoder", {
  value: JSDOMCompatibleTextEncoder,
  writable: true,
});

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  localStorage.clear();
  cleanup();
});
afterAll(() => server.close());
