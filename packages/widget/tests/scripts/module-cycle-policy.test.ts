import type { ICruiseResult } from "dependency-cruiser";
import { describe, expect, it } from "vitest";

import { findModuleCycles } from "../../scripts/architecture/module-cycle-policy";
import { resolveModule } from "../../scripts/architecture/module-map";

const module = (source: string, dependencies: ReadonlyArray<string>) =>
  ({
    dependencies: dependencies.map((resolved) => ({ resolved })),
    source,
  }) as ICruiseResult["modules"][number];

describe("Module map", () => {
  it("assigns a collection child its own Module and the collection's root files to the collection", () => {
    expect(resolveModule("src/features/borrow/entry/state/entry.ts")).toBe(
      "src/features/borrow/entry"
    );
    expect(resolveModule("src/features/borrow/index.ts")).toBe(
      "src/features/borrow"
    );
  });

  it("makes each child of a Module layer a Module, and every other layer one Module", () => {
    expect(resolveModule("src/services/zama/internal/sdk.ts")).toBe(
      "src/services/zama"
    );
    expect(resolveModule("src/services/geoblocking.ts")).toBe(
      "src/services/geoblocking.ts"
    );
    expect(resolveModule("src/app/runtime/deep-link-runtime.ts")).toBe(
      "src/app"
    );
    expect(resolveModule("src/runtime/app-runtime.ts")).toBe("src/runtime");
    expect(resolveModule("src/App.tsx")).toBe("src/App.tsx");
    expect(resolveModule("../../node_modules/react/index.js")).toBeNull();
  });
});

describe("Module cycles", () => {
  it("finds cycles between Modules even when the concrete files are acyclic", () => {
    const cycles = findModuleCycles({
      modules: [
        module("src/features/alpha/a.ts", ["src/features/beta/b.ts"]),
        module("src/features/beta/c.ts", ["src/features/alpha/d.ts"]),
      ],
    });

    expect(cycles.map((cycle) => cycle.modules)).toEqual([
      ["src/features/alpha", "src/features/beta"],
    ]);
  });

  it("finds cycles through layers that are one Module", () => {
    const cycles = findModuleCycles({
      modules: [
        module("src/features/alpha/state/a.ts", ["src/runtime/app-runtime.ts"]),
        module("src/runtime/wallet-runtime.ts", [
          "src/features/alpha/index.ts",
        ]),
      ],
    });

    expect(cycles.map((cycle) => cycle.path)).toEqual([
      ["src/features/alpha", "src/runtime", "src/features/alpha"],
    ]);
  });

  it("reports nothing when Module dependencies point one way", () => {
    expect(
      findModuleCycles({
        modules: [
          module("src/features/alpha/a.ts", ["src/features/beta/index.ts"]),
          module("src/features/beta/b.ts", ["src/runtime/app-runtime.ts"]),
        ],
      })
    ).toEqual([]);
  });
});
