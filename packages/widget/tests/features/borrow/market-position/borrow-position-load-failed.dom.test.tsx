import { RegistryProvider } from "@effect/atom-react";
import { Effect, Layer, Schema } from "effect";
import { act } from "react";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter, Outlet, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { WalletAddress } from "../../../../src/domain/identity/identifiers";
import { WalletScopeKey } from "../../../../src/domain/wallet/wallet-scope";
import { BorrowPositionDetailsPage } from "../../../../src/features/borrow/market-position/ui/details.page.tsx";
import { walletScopeAtom } from "../../../../src/features/wallet/index";
import { WalletScopeRouteContext } from "../../../../src/features/wallet/ui/wallet-scope-route-context";
import type { SKAppProps } from "../../../../src/public-api/react-types";
import { appRuntime } from "../../../../src/runtime/app-runtime";
import { ApiRequestError } from "../../../../src/services/api/resource-sources";
import { WidgetConfigService } from "../../../../src/services/config/widget-config";
import { TrackingService } from "../../../../src/services/tracking/tracking-service";
import { createWidgetI18nInstance } from "../../../../src/services/translation/widget-translation";
import {
  borrowWalletAddress,
  makeBorrowAccountSnapshot,
  makeBorrowDebtBalanceDto,
  makeBorrowIntegration,
  makeBorrowMarket,
  makeBorrowSupplyBalanceDto,
} from "../../../fixtures/borrow";
import { borrowResourceSourceLayer } from "../../../utils/services/borrow-resource-source";
import { render } from "../../../utils/test-utils.dom.tsx";
import { applicationRuntimeInitInitialValue } from "../../../utils/widget-config";

const hostConfiguration: SKAppProps = {
  apiKey: "test-api-key",
  borrowEnabled: true,
  dashboardVariant: true,
  variant: "default",
};
const i18nInstance = createWidgetI18nInstance();
const address = Schema.decodeSync(WalletAddress)(borrowWalletAddress);
const walletScope = new WalletScopeKey({ address, network: "ethereum" });
const integration = makeBorrowIntegration();
const market = makeBorrowMarket();
const account = makeBorrowAccountSnapshot({
  debtBalances: [makeBorrowDebtBalanceDto()],
  supplyBalances: [makeBorrowSupplyBalanceDto()],
  totalCollateralUsd: "1000",
  totalSuppliedUsd: "1000",
});

const positionsUnavailable = new ApiRequestError({
  cause: new Error("positions unavailable"),
  failure: { _tag: "Unreachable" },
  operation: "borrow-positions",
});

// jsdom has no Web Animations; the split view's scroll area asks for them.
if (!("getAnimations" in Element.prototype)) {
  Object.defineProperty(Element.prototype, "getAnimations", {
    value: () => [],
  });
}

const ScopedRoute = () => (
  <WalletScopeRouteContext.Provider value={walletScope}>
    <Outlet />
  </WalletScopeRouteContext.Provider>
);

const renderPage = (
  getPositionData: () => Effect.Effect<
    ReadonlyArray<{
      readonly integration: typeof integration;
      readonly position: typeof account;
    }>,
    ApiRequestError
  >
) => {
  const appLayer = Layer.mergeAll(
    borrowResourceSourceLayer({
      getIntegrations: Effect.succeed([integration]),
      getMarkets: () =>
        Effect.succeed({ items: [market], limit: 100, offset: 0, total: 1 }),
      getPositionData,
    }),
    Layer.succeed(
      TrackingService,
      TrackingService.of({
        trackEvent: () => Effect.void,
        trackPageView: () => Effect.void,
      })
    ),
    WidgetConfigService.layer(hostConfiguration)
  );

  return render(
    <I18nextProvider i18n={i18nInstance}>
      <RegistryProvider
        initialValues={[
          applicationRuntimeInitInitialValue(hostConfiguration),
          [appRuntime.layer, appLayer],
          [walletScopeAtom, walletScope],
        ]}
      >
        <MemoryRouter initialEntries={[`/positions/borrow/${market.id}`]}>
          <Routes>
            <Route element={<ScopedRoute />}>
              <Route
                path="/positions/borrow/:marketId"
                element={<BorrowPositionDetailsPage />}
              />
              <Route path="/positions" element={null} />
            </Route>
          </Routes>
        </MemoryRouter>
      </RegistryProvider>
    </I18nextProvider>
  );
};

describe("Borrow position details load failure", () => {
  it("offers Retry over both columns, and Retry requests the position again", async () => {
    // The positions stay unreachable until the backend recovers.
    let reachable = false;
    let requests = 0;
    const app = await renderPage(() =>
      Effect.suspend(() => {
        requests += 1;
        return reachable
          ? Effect.succeed([{ integration, position: account }])
          : Effect.fail(positionsUnavailable);
      })
    );

    const failure = () =>
      app.container.querySelector<HTMLElement>(
        '[data-testid="borrow-position-load-failed"]'
      );
    await vi.waitFor(() => expect(failure()).not.toBeNull());
    // One error stands for the whole page, under the trail back.
    expect(
      app.container.querySelectorAll(
        '[data-testid="borrow-position-load-failed"]'
      )
    ).toHaveLength(1);
    expect(
      app.container.querySelector('[data-testid="position-page-back"]')
    ).not.toBeNull();

    const retry = failure()?.querySelector("button");
    if (!retry) throw new Error("Expected Retry");
    expect(retry.textContent).toBe("Try again");
    reachable = true;
    const requestsBeforeRetry = requests;
    await act(async () => retry.click());

    await vi.waitFor(() => expect(failure()).toBeNull());
    expect(requests).toBeGreaterThan(requestsBeforeRetry);
    await vi.waitFor(() =>
      expect(
        app.container.querySelector('[data-testid="borrow-position-summary"]')
      ).not.toBeNull()
    );
  });
});
