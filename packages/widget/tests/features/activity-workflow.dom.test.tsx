import { act, type ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { SKAtomRegistryProvider } from "../../src/app/composition/providers/atom-runtime";
import { normalizeWidgetConfig } from "../../src/app/config/settings";
import type { ActivityFilterOption } from "../../src/features/activity/model/filters";
import { useActivityFilter } from "../../src/features/activity/react/use-activity-filter";
import { CompletePageComponent } from "../../src/features/transaction-flow/ui/complete/pages/common.page";
import { i18nInstance } from "../../src/translation";
import { render } from "../utils/test-utils.dom";

const settings = normalizeWidgetConfig({
  apiKey: "test-api-key",
  variant: "default",
});

const ActivityFilterHarness = ({
  options,
}: {
  readonly options: ReadonlyArray<ActivityFilterOption>;
}) => {
  const { selectedFilter, setSelectedFilter } = useActivityFilter(options);

  return (
    <>
      <output>{selectedFilter}</output>
      <button type="button" onClick={() => setSelectedFilter("defi")}>
        DeFi
      </button>
    </>
  );
};

const wrap = (children: ReactNode) => (
  <SKAtomRegistryProvider settings={settings}>
    <I18nextProvider i18n={i18nInstance}>
      <MemoryRouter>{children}</MemoryRouter>
    </I18nextProvider>
  </SKAtomRegistryProvider>
);

describe("activity and completion workflows", () => {
  it("stores the selected activity filter in the feature atom and falls back when unavailable", async () => {
    const options: ActivityFilterOption[] = [{ count: 1, filter: "defi" }];
    const app = await render(wrap(<ActivityFilterHarness options={options} />));

    expect(app.container.querySelector("output")?.textContent).toBe("all");

    await act(async () => {
      app.container.querySelector("button")?.click();
    });

    expect(app.container.querySelector("output")?.textContent).toBe("defi");

    await app.rerender(wrap(<ActivityFilterHarness options={[]} />));

    expect(app.container.querySelector("output")?.textContent).toBe("all");
  });

  it("renders completion transaction actions from explicit workflow input", async () => {
    const onViewTransactionClick = vi.fn();
    const app = await render(
      wrap(
        <CompletePageComponent
          amount="1"
          completion={{
            cta: null,
            onViewTransactionClick,
            pendingActionMatch: false,
            unstakeMatch: false,
            urls: [{ type: "STAKE", url: "https://explorer.test/tx" }],
          }}
          integrationId="test-yield"
          metadata={null}
          network="ethereum"
          providersDetails={null}
          token={null}
          yieldType={null}
        />
      )
    );
    const transactionButton = app.container.querySelector<HTMLButtonElement>(
      'button:not([data-rk^="footer-button"])'
    );

    expect(transactionButton?.textContent).toContain("View Stake transaction");

    await act(async () => transactionButton?.click());

    expect(onViewTransactionClick).toHaveBeenCalledWith(
      "https://explorer.test/tx"
    );
  });
});
