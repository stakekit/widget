import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  declarationSpecifiers,
  resolveDeclarationImport,
} from "../../scripts/declarations/declaration-graph";

describe("declaration graph", () => {
  it("collects import, export, and type-query specifiers", () => {
    const specifiers = declarationSpecifiers(
      "entry.d.ts",
      `
        import type { Foo } from "./foo";
        export { Bar } from "./bar";
        type Baz = import("./baz").Baz;
      `
    );

    expect([...specifiers].sort()).toEqual(["./bar", "./baz", "./foo"]);
  });

  it("resolves an extensionless specifier to a .d.ts file and a .js import", async () => {
    const declarationRoot = await mkdtemp(join(tmpdir(), "declaration-graph-"));

    try {
      await writeFile(join(declarationRoot, "from.d.ts"), "export {};\n");
      await writeFile(join(declarationRoot, "target.d.ts"), "export {};\n");

      await expect(
        resolveDeclarationImport({
          declarationRoot,
          fromPath: join(declarationRoot, "from.d.ts"),
          specifier: "./target",
        })
      ).resolves.toEqual({
        declarationPath: join(declarationRoot, "target.d.ts"),
        finalizedSpecifier: "./target.js",
      });
    } finally {
      await rm(declarationRoot, { force: true, recursive: true });
    }
  });

  it("rejects a specifier that leaves the declaration root", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "declaration-graph-"));
    const declarationRoot = join(workspace, "types");

    try {
      await mkdir(declarationRoot);
      await writeFile(join(declarationRoot, "from.d.ts"), "export {};\n");
      await writeFile(join(workspace, "outside.d.ts"), "export {};\n");

      await expect(
        resolveDeclarationImport({
          declarationRoot,
          fromPath: join(declarationRoot, "from.d.ts"),
          specifier: "../outside",
        })
      ).rejects.toThrow(/escapes/);
    } finally {
      await rm(workspace, { force: true, recursive: true });
    }
  });
});
