import { afterAll, afterEach } from "vitest";

// Development React reports these through console.error instead of throwing.
// They mean the component is broken, so the test that caused them must fail.
const failingReactErrors = [
  "React has detected a change in the order of Hooks",
];

const isFailingReactError = (message: unknown) =>
  typeof message === "string" &&
  failingReactErrors.some((error) => message.includes(error));

/**
 * Fails the current test when React reports one of `failingReactErrors`. The
 * message still reaches the console; a report after the last test fails the
 * file.
 */
export const failOnReactErrors = () => {
  const detected: Array<string> = [];
  const original = console.error.bind(console);

  console.error = (...args: Array<unknown>) => {
    if (isFailingReactError(args[0])) {
      detected.push(args.map(String).join(" "));
    }
    original(...args);
  };

  const assertNoReactErrors = () => {
    const errors = detected.splice(0);
    if (errors.length > 0) {
      throw new Error(`React reported:\n\n${errors.join("\n\n")}`);
    }
  };

  afterEach(assertNoReactErrors);
  afterAll(assertNoReactErrors);
};
