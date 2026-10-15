import { describe, expect, it } from "vitest";
import {
  findMisplacedTestDirectories,
  isTestFile,
} from "../../scripts/architecture/test-layout-policy";

const sourceDirectories = new Set([
  "app",
  "app/routes",
  "features",
  "features/borrow",
  "features/borrow/positions",
  "services",
  "services/wallet",
]);

describe("test layout policy", () => {
  it("recognizes Vitest test files by suffix", () => {
    expect(isTestFile("features/borrow/a.test.ts")).toBe(true);
    expect(isTestFile("app/routes/a.dom.test.tsx")).toBe(true);
    expect(isTestFile("app/journeys/a.browser.test.tsx")).toBe(true);
    expect(isTestFile("app/journeys/staking/setup.ts")).toBe(false);
  });

  it("accepts test directories that mirror an existing src directory", () => {
    expect(
      findMisplacedTestDirectories({
        sourceDirectories,
        testFiles: [
          "app/routes/initial-route.test.ts",
          "features/borrow/positions/a.test.ts",
          "features/borrow/architecture.test.ts",
          "services/wallet/wallet-state.test.ts",
        ],
      })
    ).toEqual([]);
  });

  it("accepts support directories and their descendants", () => {
    expect(
      findMisplacedTestDirectories({
        sourceDirectories,
        testFiles: [
          "fixtures/a.test.ts",
          "mocks/nested/a.test.ts",
          "utils/services/a.test.ts",
          "package-types/a.test.ts",
          "scripts/a.test.ts",
          "generated/a.test.ts",
          "app/journeys/geo-block.browser.test.tsx",
          "app/journeys/staking-flow/staking-flow.browser.test.tsx",
        ],
      })
    ).toEqual([]);
  });

  it("reports each directory without a src counterpart once, sorted", () => {
    expect(
      findMisplacedTestDirectories({
        sourceDirectories,
        testFiles: [
          "providers/wallet/a.test.ts",
          "pages-dashboard/b.browser.test.tsx",
          "providers/wallet/c.test.ts",
          "features/borrow/architecture/d.test.ts",
          "a-root-level.test.ts",
          "utilsx/e.test.ts",
        ],
      })
    ).toEqual([
      ".",
      "features/borrow/architecture",
      "pages-dashboard",
      "providers/wallet",
      "utilsx",
    ]);
  });
});
