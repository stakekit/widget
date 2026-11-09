import { describe, expect, it } from "vitest";

import { entryLoadFiles } from "../../scripts/bundle-size/entry-load";

// The shape of `dist/*/.vite/manifest.json`: chunks keyed by source id, static
// `imports` by key, `dynamicImports` loaded only on demand.
const manifest = {
  "src/index.package.ts": {
    file: "index.package.js",
    isEntry: true,
    imports: ["_runtime.js", "_effect.js"],
    dynamicImports: ["src/cardano-connector.ts"],
  },
  "_runtime.js": { file: "runtime.js" },
  "_effect.js": { file: "effect.js", imports: ["_runtime.js"] },
  "src/cardano-connector.ts": {
    file: "cardano-connector.js",
    isDynamicEntry: true,
    imports: ["_mesh.js"],
  },
  "_mesh.js": { file: "mesh.js" },
};

describe("entry load files", () => {
  it("counts the entry and every chunk it imports statically, once", () => {
    expect(
      [...entryLoadFiles(manifest, "src/index.package.ts")].sort()
    ).toEqual(["effect.js", "index.package.js", "runtime.js"]);
  });

  it("leaves out chunks the entry loads only through import()", () => {
    expect(entryLoadFiles(manifest, "src/index.package.ts")).not.toContain(
      "mesh.js"
    );
  });

  it("fails for an entry the manifest does not hold", () => {
    expect(() => entryLoadFiles(manifest, "src/index.bundle.ts")).toThrow(
      "src/index.bundle.ts"
    );
  });
});
