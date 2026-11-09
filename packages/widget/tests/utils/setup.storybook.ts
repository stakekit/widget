import { afterAll, afterEach } from "vitest";

// A story test fails on any console.error: React reports broken rendering
// (keys, invalid DOM nesting, hook order) only there, so a story could render
// with them and stay green. Calls still reach the console. Errors logged
// outside a test fail the file instead.

const logged: Array<string> = [];
const original = console.error;

console.error = (...args: Array<unknown>) => {
  logged.push(args.map(String).join(" "));
  Reflect.apply(original, console, args);
};

const assertNoConsoleErrors = () => {
  const errors = logged.splice(0);
  if (errors.length > 0) {
    throw new Error(`console.error was called:\n\n${errors.join("\n\n")}`);
  }
};

afterEach(assertNoConsoleErrors);
afterAll(() => {
  console.error = original;
  assertNoConsoleErrors();
});
