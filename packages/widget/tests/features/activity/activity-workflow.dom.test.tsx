import { Schema } from "effect";
import { act, type ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { SKAtomRegistryProvider } from "../../../src/app/composition/providers/atom-runtime";
import { applicationRoutes } from "../../../src/app/routes/application-routes";
import { YieldId } from "../../../src/domain/identity/identifiers";
import { WalletScopeKey } from "../../../src/domain/wallet/wallet-scope";
import type { ActivityActionItem } from "../../../src/features/activity/model/activity-action";
import type { ActivityPageView } from "../../../src/features/activity/model/page-view";
import { ActivityPagePresentation } from "../../../src/features/activity/ui/activity-page/activity-page-presentation";
import { CompletePageComponent } from "../../../src/features/yield-transaction-flow/ui/complete/pages/common.page.tsx";
import { createWidgetI18nInstance } from "../../../src/services/translation/widget-translation";
import { yieldApiActionFixture, yieldApiYieldFixture } from "../../fixtures";
import { render } from "../../utils/test-utils.dom.tsx";

const i18nInstance = createWidgetI18nInstance();

vi.mock(
  "../../../src/features/activity/ui/activity-page/components/action-list-item",
  () => ({
    ActionListItem: ({ action }: { readonly action: ActivityActionItem }) => (
      <div data-rk="activity-action">{action.actionData.id}</div>
    ),
  })
);

const settings = {
  apiKey: "test-api-key",
  variant: "default" as const,
};

const wrap = (children: ReactNode) => (
  <SKAtomRegistryProvider
    routes={applicationRoutes}
    hostConfiguration={settings}
  >
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
      app.container.querySelector('[data-testid="activity-connect-wallet"]')
        ?.textContent
    ).toContain("Connect");
    // The connect-wallet state offers the connect action itself (UX I1).
    expect(
      app.container.querySelector(
        '[data-testid="activity-connect-wallet"] button'
      )?.textContent
    ).toBe("Connect wallet");

    await app.rerender(wrap(activityPage({ status: "connecting" })));
    expect(
      app.container.querySelectorAll('[data-testid="activity-page-skeleton"]')
    ).toHaveLength(1);

    await app.rerender(wrap(activityPage({ status: "loading" })));
    expect(
      app.container.querySelectorAll('[data-testid="activity-page-skeleton"]')
    ).toHaveLength(1);

    await app.rerender(wrap(activityPage({ status: "failed" })));
    const pageRetry = app.container.querySelector<HTMLButtonElement>(
      '[data-testid="activity-page-error"] button'
    );
    await act(async () => pageRetry?.click());
    expect(onRetry).toHaveBeenCalledOnce();

    // No activity at all leads to Earn.
    await app.rerender(wrap(activityPage({ status: "empty" })));
    const empty = app.container.querySelector('[data-testid="activity-empty"]');
    expect(empty?.textContent).toContain("No activity yet");
    expect(empty?.querySelector("button")?.textContent).toBe("Start earning");

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
    expect(app.container.textContent).toContain("No activity of this type");

    const yieldModel = yieldApiYieldFixture();
    const item: ActivityActionItem = {
      _tag: "yield",
      actionData: yieldApiActionFixture({
        id: "retained-action",
        yieldId: yieldModel.id,
      }),
      validatorsData: [],
      walletScope: new WalletScopeKey({
        address: Schema.decodeSync(
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
      '[data-testid="activity-load-more-error"] button'
    );
    await act(async () => loadMoreRetry?.click());
    expect(onLoadMore).toHaveBeenCalledOnce();
  });

  it("links each completed transaction to its explorer and records the visit", async () => {
    const onViewTransactionClick = vi.fn();
    const app = await render(
      wrap(
        <CompletePageComponent
          amount="1"
          completion={{
            attribution: null,
            cta: null,
            onViewTransactionClick,
            pendingActionMatch: false,
            positionTotal: null,
            unstakeMatch: false,
            urls: [
              { hash: null, type: "STAKE", url: "https://explorer.test/tx" },
            ],
            viewPositionCta: null,
          }}
          integrationId={YieldId.make("test-yield")}
          network="ethereum"
          markToken={null}
          yieldType={null}
        />
      )
    );
    const explorerLink = app.container.querySelector<HTMLAnchorElement>(
      'a[href="https://explorer.test/tx"]'
    );

    expect(explorerLink?.textContent).toContain("View Stake transaction");
    expect(explorerLink?.target).toBe("_blank");

    // Keep jsdom from navigating; the click still reaches the link's handler.
    explorerLink?.addEventListener("click", (event) => event.preventDefault());
    await act(async () => explorerLink?.click());

    expect(onViewTransactionClick).toHaveBeenCalledOnce();
  });
});
