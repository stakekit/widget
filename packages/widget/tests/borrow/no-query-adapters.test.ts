import { describe, expect, it } from "vitest";
import borrowPageSource from "../../src/features/borrow/ui/index.tsx?raw";
import borrowPositionDetailsSource from "../../src/features/borrow/ui/position-details.tsx?raw";
import borrowDashboardHookSource from "../../src/features/borrow/ui/use-borrow-dashboard.ts?raw";
import borrowPositionsHookSource from "../../src/features/borrow/ui/use-borrow-positions.ts?raw";
import managePositionsSource from "../../src/features/portfolio/ui/dashboard/positions/positions.page.tsx?raw";
import summarySource from "../../src/features/portfolio/ui/dashboard/summary/index.tsx?raw";

const borrowConsumerSources = {
  borrowDashboardHookSource,
  borrowPageSource,
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
