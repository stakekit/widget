import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { checkPromiseOwnership } from "../../scripts/check-classic-flow-architecture";
import fixtureSource from "./fixtures/promise-handler.tsx?raw";

describe("Classic Flow architecture", () => {
  it("rejects every Promise-owned view path and proves the router exception", () => {
    expect(fixtureSource).toContain("useRouterNavigate");

    const fixture = fileURLToPath(
      new URL("./fixtures/promise-handler.tsx", import.meta.url)
    );
    const program = ts.createProgram([fixture], {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      strict: true,
      target: ts.ScriptTarget.ES2022,
    });

    const failures = checkPromiseOwnership(
      program,
      (sourceFile) => sourceFile.fileName === fixture
    );

    expect(failures).toHaveLength(9);
    expect(
      failures.map((failure) => Number(failure.match(/:(\d+):\d+ /)?.[1]))
    ).toEqual([8, 10, 13, 14, 21, 22, 24, 25, 31]);
  });
});
