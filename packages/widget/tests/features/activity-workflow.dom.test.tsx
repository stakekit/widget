import { Schema } from "effect";
import { act, type ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { SKAtomRegistryProvider } from "../../src/app/composition/providers/atom-runtime";
import { normalizeWidgetConfig } from "../../src/app/config/settings";
import { applicationRoutes } from "../../src/app/routes/application-routes";
import type { ActivityActionItem } from "../../src/features/activity/model/activity-action";
import type { ActivityPageView } from "../../src/features/activity/state/page";
import { ActivityPagePresentation } from "../../src/features/activity/ui/activity-page/activity-page-presentation";
import { CompletePageComponent } from "../../src/features/classic-transaction-flow/ui/complete/pages/common.page";
import { createWidgetI18nInstance } from "../../src/services/translation/widget-translation";
import { WalletScopeKey } from "../../src/services/wallet/domain/scope";
import { yieldApiActionFixture, yieldApiYieldFixture } from "../fixtures";
import { render } from "../utils/test-utils.dom";

const i18nInstance = createWidgetI18nInstance();

vi.mock(
  "../../src/features/activity/ui/activity-page/components/action-list-item",
  () => ({
    ActionListItem: ({ action }: { readonly action: ActivityActionItem }) => (
      <div data-rk="activity-action">{action.actionData.id}</div>
    ),
  })
);

const settings = normalizeWidgetConfig({
  apiKey: "test-api-key",
  variant: "default",
});

const wrap = (children: ReactNode) => (
  <SKAtomRegistryProvider routes={applicationRoutes} settings={settings}>
    <I18nextProvider i18n={i18nInstance}>
      <MemoryRouter>{children}</MemoryRouter>
    </I18nextProvider>
  </SKAtomRegistryProvider>
);

describe("activity and completion workflows", () => {
  it("renders every headless Activity page status and its retry controls", async () => {
    const onActionSelect = vi.fn();
    const onFilterSelect = vi.fn();
    const onLoadMore = vi.fn();
    const onRetry = vi.fn();
    const activityPage = (view: ActivityPageView) => (
      <ActivityPagePresentation
        onActionSelect={onActionSelect}
        onFilterSelect={onFilterSelect}
        onLoadMore={onLoadMore}
        onRetry={onRetry}
        view={view}
      />
    );
    const app = await render(wrap(activityPage({ status: "connect-wallet" })));

    expect(
      app.container.querySelector('[data-rk="activity-connect-wallet"]')
        ?.textContent
    ).toContain("Connect");

    await app.rerender(wrap(activityPage({ status: "connecting" })));
    expect(
      app.container.querySelectorAll('[data-rk="activity-page-skeleton"]')
    ).toHaveLength(1);

    await app.rerender(wrap(activityPage({ status: "loading" })));
    expect(
      app.container.querySelectorAll('[data-rk="activity-page-skeleton"]')
    ).toHaveLength(1);

    await app.rerender(wrap(activityPage({ status: "failed" })));
    const pageRetry = app.container.querySelector<HTMLButtonElement>(
      '[data-rk="activity-page-error"] button'
    );
    await act(async () => pageRetry?.click());
    expect(onRetry).toHaveBeenCalledOnce();

    await app.rerender(wrap(activityPage({ status: "empty" })));
    expect(app.container.textContent).toContain("No previous activity");

    await app.rerender(
      wrap(
        activityPage({
          actions: [],
          filterOptions: [
            { count: 2, filter: "all" },
            { count: 0, filter: "defi" },
          ],
          pagination: { status: "complete" },
          selectedFilter: "defi",
          showingCount: 0,
          status: "ready",
          total: 0,
        })
      )
    );
    expect(app.container.textContent).toContain("DeFi");
    expect(app.container.textContent).toContain("No previous activity");

    const yieldModel = yieldApiYieldFixture();
    const item: ActivityActionItem = {
      actionData: yieldApiActionFixture({
        id: "retained-action",
        yieldId: yieldModel.id,
      }),
      validatorsData: [],
      walletScope: new WalletScopeKey({
        address: Schema.decodeUnknownSync(
          Schema.NonEmptyString.pipe(Schema.brand("WalletAddress"))
        )("0x0000000000000000000000000000000000000001"),
        network: "ethereum",
      }),
      yieldData: yieldModel,
    };
    await app.rerender(
      wrap(
        activityPage({
          actions: [item],
          filterOptions: [],
          pagination: { status: "load-more-failed" },
          selectedFilter: "all",
          showingCount: 1,
          status: "ready",
          total: 2,
        })
      )
    );
    expect(app.container.textContent).toContain("Showing 1 of 2");
    const loadMoreRetry = app.container.querySelector<HTMLButtonElement>(
      '[data-rk="activity-load-more-error"] button'
    );
    await act(async () => loadMoreRetry?.click());
    expect(onLoadMore).toHaveBeenCalledOnce();
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
