import { describe, expect, it } from "vitest";
import borrowDashboardHookSource from "../../src/features/borrow/react/use-borrow-dashboard.ts?raw";
import borrowPositionsHookSource from "../../src/features/borrow/react/use-borrow-positions.ts?raw";
import borrowFormPageSource from "../../src/features/borrow/ui/borrow-form.page.tsx?raw";
import borrowLayoutSource from "../../src/features/borrow/ui/borrow-layout.tsx?raw";
import borrowDetailsPanelSource from "../../src/features/borrow/ui/components/borrow-details-panel.tsx?raw";
import borrowPositionDetailsSource from "../../src/features/borrow/ui/position-details/position-details.page.tsx?raw";
import managePositionsSource from "../../src/features/portfolio/ui/dashboard/positions/positions.page.tsx?raw";
import summarySource from "../../src/features/portfolio/ui/dashboard/summary/index.tsx?raw";

const borrowConsumerSources = {
  borrowDashboardHookSource,
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
