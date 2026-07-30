import { MotionGlobalConfig } from "motion/react";
import { vi } from "vitest";

MotionGlobalConfig.skipAnimations = true;

vi.setConfig({ testTimeout: 60000 });

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
