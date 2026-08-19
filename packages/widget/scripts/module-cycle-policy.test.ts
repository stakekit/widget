import type { ICruiseResult } from "dependency-cruiser";
import { describe, expect, it } from "vitest";
import {
  checkOwnedModuleCycles,
  type ModuleCyclePolicy,
  resolveOwnedModule,
} from "./module-cycle-policy";

const policy: ModuleCyclePolicy = {
  moduleCollections: [
    {
      interfaces: ["index", "composition", "views", "runtime"],
      kind: "feature",
      root: "src/features",
    },
    {
      excludedChildren: ["model", "state", "ui"],
      interfaces: ["index", "composition", "views", "runtime"],
      kind: "nested-feature",
      parent: "src/features/borrow",
      root: "src/features/borrow",
    },
    { interfaces: ["index"], kind: "resource", root: "src/resources" },
  ],
  ownedModules: [
    {
      interfaces: { operations: [], "resource-sources": [], runtime: [] },
      kind: "api",
      root: "src/services/api",
    },
  ],
};

const module = (source: string, dependencies: ReadonlyArray<string>) =>
  ({
    dependencies: dependencies.map((resolved) => ({ resolved })),
    source,
  }) as ICruiseResult["modules"][number];

describe("owned Module cycle policy", () => {
  it("assigns the most-specific nested owner while parent internals stay parent-owned", () => {
    expect(
      resolveOwnedModule("src/features/borrow/entry/state/entry.ts", policy)
    ).toBe("src/features/borrow/entry");
    expect(
      resolveOwnedModule("src/features/borrow/state/runtime.ts", policy)
    ).toBe("src/features/borrow");
    expect(resolveOwnedModule("src/services/api/runtime.ts", policy)).toBe(
      "src/services/api"
    );
  });

  it("finds ownership cycles even when the concrete files are acyclic", () => {
    const result = checkOwnedModuleCycles({
      baseline: [],
      cruiseResult: {
        modules: [
          module("src/features/alpha/a.ts", ["src/features/beta/b.ts"]),
          module("src/features/beta/c.ts", ["src/features/alpha/d.ts"]),
        ],
      },
      policy,
    });

    expect(result.cycles).toHaveLength(1);
    expect(result.cycles[0]?.modules).toEqual([
      "src/features/alpha",
      "src/features/beta",
    ]);
    expect(result.unbaselinedEdges).toEqual([
      { from: "src/features/alpha", to: "src/features/beta" },
      { from: "src/features/beta", to: "src/features/alpha" },
    ]);
  });

  it("rejects new cyclic edges and stale exact baselines", () => {
    const result = checkOwnedModuleCycles({
      baseline: [
        { from: "src/features/alpha", to: "src/features/beta" },
        { from: "src/features/obsolete", to: "src/features/alpha" },
      ],
      cruiseResult: {
        modules: [
          module("src/features/alpha/a.ts", ["src/features/beta/b.ts"]),
          module("src/features/beta/c.ts", ["src/features/alpha/d.ts"]),
        ],
      },
      policy,
    });

    expect(result.unbaselinedEdges).toEqual([
      { from: "src/features/beta", to: "src/features/alpha" },
    ]);
    expect(result.staleBaseline).toEqual([
      { from: "src/features/obsolete", to: "src/features/alpha" },
    ]);
  });
});
