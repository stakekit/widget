import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { findAsyncResultValues } from "../../scripts/architecture/async-result-in-ui";

const asyncResultModule = `
export interface Initial<A, E> { readonly _tag: "Initial" }
export interface Success<A, E> { readonly _tag: "Success"; readonly value: A }
export interface Failure<A, E> { readonly _tag: "Failure"; readonly error: E }
export type AsyncResult<A, E = never> = Initial<A, E> | Success<A, E> | Failure<A, E>;
`;

const state = `
import type { AsyncResult } from "effect/reactivity/AsyncResult";
export declare const positionResult: AsyncResult<number, string>;
export declare const position: number | null;
export declare const read: <A>(value: A) => A;
`;

const roots: string[] = [];
afterAll(() => {
  for (const root of roots) rmSync(root, { force: true, recursive: true });
});

const project = (ui: string) => {
  const root = mkdtempSync(path.join(tmpdir(), "async-result-in-ui-"));
  roots.push(root);
  const files: Record<string, string> = {
    "node_modules/effect/reactivity/AsyncResult.d.ts": asyncResultModule,
    "src/features/borrow/state/positions.ts": state,
    "src/features/borrow/ui/page.ts": ui,
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        module: "esnext",
        moduleResolution: "bundler",
        paths: {
          "effect/reactivity/AsyncResult": [
            "./node_modules/effect/reactivity/AsyncResult.d.ts",
          ],
        },
        strict: true,
      },
      include: ["src"],
    }),
  };
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), content);
  }
  return path.join(root, "tsconfig.json");
};

const isUi = (fileName: string) => fileName.includes("/ui/");

describe("AsyncResult values in Feature UI", () => {
  it("reports an AsyncResult that reaches UI without importing its module", () => {
    const uses = findAsyncResultValues(
      project(`
import { positionResult, read } from "../state/positions";
export const shown = read(positionResult);
`),
      isUi
    );

    expect(uses).toEqual([
      expect.objectContaining({
        file: expect.stringMatching(/\/src\/features\/borrow\/ui\/page\.ts$/i),
        line: 3,
      }),
    ]);
  });

  it("accepts plain values published by state", () => {
    expect(
      findAsyncResultValues(
        project(`
import { position } from "../state/positions";
export const shown = position ?? 0;
`),
        isUi
      )
    ).toEqual([]);
  });

  it("ignores AsyncResult outside UI files", () => {
    expect(
      findAsyncResultValues(project("export const shown = 1;"), isUi)
    ).toEqual([]);
  });
});
