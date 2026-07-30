import { describe, expect, it } from "vitest";
import borrowEntryHookSource from "../../../src/features/borrow/borrow-entry/react/use-borrow-entry.ts?raw";
import borrowDetailsPanelSource from "../../../src/features/borrow/borrow-entry/ui/components/details-panel.tsx?raw";
import borrowLayoutSource from "../../../src/features/borrow/borrow-entry/ui/layout.tsx?raw";
import borrowFormPageSource from "../../../src/features/borrow/borrow-entry/ui/page.tsx?raw";
import borrowPositionDetailsSource from "../../../src/features/borrow/market-position/ui/details.page.tsx?raw";
import borrowPositionsHookSource from "../../../src/features/borrow/positions/react/use-borrow-positions.ts?raw";
import managePositionsSource from "../../../src/features/portfolio/ui/dashboard/positions/positions.page.tsx?raw";
import summarySource from "../../../src/features/portfolio/ui/dashboard/summary/index.tsx?raw";

const borrowConsumerSources = {
  borrowEntryHookSource,
  borrowDetailsPanelSource,
  borrowFormPageSource,
  borrowLayoutSource,
  borrowPositionDetailsSource,
  borrowPositionsHookSource,
  managePositionsSource,
  summarySource,
};

describe("borrow AsyncResult consumers", () => {
  it("does not expose or consume query-shaped borrow adapter names", () => {
    for (const [name, source] of Object.entries(borrowConsumerSources)) {
      expect(source, name).not.toMatch(/\btoQueryState\b/);
      expect(source, name).not.toMatch(/\bmarketsQuery\b/);
      expect(source, name).not.toMatch(/\bintegrationsQuery\b/);
    }
  });
});
