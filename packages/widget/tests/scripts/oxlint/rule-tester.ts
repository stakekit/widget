import { RuleTester } from "oxlint/plugins-dev";
import { describe, it } from "vitest";

import type { Rule } from "../../../scripts/oxlint/rule";

RuleTester.describe = describe;
RuleTester.it = it;

export const tester = new RuleTester();
export const widget = "/repo/packages/widget/";

type Snippet = Readonly<{ code: string; filename: string }>;

type Cases = Readonly<{
  filename: string;
  message: string;
  valid: ReadonlyArray<string>;
  invalid: ReadonlyArray<string>;
  /** Files where every invalid snippet is valid, or single valid snippets. */
  outOfScope: ReadonlyArray<string | Snippet>;
}>;

/**
 * Runs a plugin rule over snippet lists: every invalid snippet must report
 * `message` once in `filename`; `outOfScope` snippets report nothing.
 */
export const ruleRunner =
  <Name extends string>(rules: Readonly<Record<Name, Rule>>) =>
  (name: Name, cases: Cases) =>
    tester.run(name, rules[name], {
      valid: [
        ...cases.valid.map((code) => ({ code, filename: cases.filename })),
        ...cases.outOfScope.flatMap((entry) =>
          typeof entry === "string"
            ? cases.invalid.map((code) => ({ code, filename: entry }))
            : [entry]
        ),
      ],
      invalid: cases.invalid.map((code) => ({
        code,
        filename: cases.filename,
        errors: [{ message: cases.message }],
      })),
    });
