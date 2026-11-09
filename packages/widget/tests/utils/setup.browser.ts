import { MotionGlobalConfig } from "motion/react";
import { beforeEach, vi } from "vitest";

import { failOnReactErrors } from "./fail-on-react-errors";
import { movePointerOffPage } from "./pointer";

MotionGlobalConfig.skipAnimations = true;
// Before the console spies below, so they forward to the detecting console.error.
failOnReactErrors();

const ignoredConsoleMessages = [
  "All fibers interrupted without error",
  "Lit is in dev mode",
];

const getConsoleMessage = (arg: unknown) => {
  if (arg instanceof Error) {
    return `${arg.name}: ${arg.message}`;
  }

  return typeof arg === "string" ? arg : "";
};

const isIgnoredConsoleNoise = (args: ReadonlyArray<unknown>) =>
  args.some((arg) => {
    const message = getConsoleMessage(arg);

    return ignoredConsoleMessages.some((ignored) => message.includes(ignored));
  });

const silenceConsoleNoise = (method: "error" | "log" | "warn") => {
  const original = console[method].bind(console);

  vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
    if (isIgnoredConsoleNoise(args)) {
      return;
    }

    original(...args);
  });
};

silenceConsoleNoise("error");
silenceConsoleNoise("log");
silenceConsoleNoise("warn");

// The pointer stays wherever the last test left it, across test files too;
// a Widget mounted under it renders hovered and then changes as hover is
// re-evaluated. Each test starts with the pointer off the page.
beforeEach(movePointerOffPage);
