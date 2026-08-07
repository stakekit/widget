import { useState } from "react";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { shouldRegisterDashboardEarnFooterButton } from "../../src/app/routes/dashboard-routes";
import type { PositionDetailsActionMode } from "../../src/features/position-details/model/hub";
import { PositionDetailsActionTabs } from "../../src/features/position-details/ui/dashboard/components/position-details-action-tabs";
import { createWidgetI18nInstance } from "../../src/services/translation/widget-translation";
import { render } from "../utils/test-utils";

const i18nInstance = createWidgetI18nInstance();

const LocationProbe = () => {
  const location = useLocation();

  return <div data-testid="location">{location.pathname}</div>;
};

const ControlledTabs = ({
  canStake = true,
  canUnstake = true,
}: {
  canStake?: boolean;
  canUnstake?: boolean;
}) => {
  const [selectedMode, setSelectedMode] =
    useState<PositionDetailsActionMode>("unstake");

  return (
    <>
      <PositionDetailsActionTabs
        canStake={canStake}
        canUnstake={canUnstake}
        selectedMode={selectedMode}
        onSelectMode={setSelectedMode}
      />
      <div data-testid="selected-mode">{selectedMode}</div>
    </>
  );
};

const renderTabs = (initialEntries: string | string[]) => {
  const entries = Array.isArray(initialEntries)
    ? [initialEntries].flat()
    : [initialEntries];

  return render(
    <I18nextProvider i18n={i18nInstance}>
      <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}>
        <LocationProbe />

        <Routes>
          <Route path="positions">
            <Route index element={<div data-testid="route-kind">manage</div>} />
            <Route
              path=":integrationId/:balanceId"
              element={<ControlledTabs />}
            />
          </Route>
        </Routes>
      </MemoryRouter>
    </I18nextProvider>
  );
};

describe("position details action tabs", () => {
  it("registers the earn CTA only for the earn index", () => {
    expect(shouldRegisterDashboardEarnFooterButton("/")).toBe(true);
    expect(
      shouldRegisterDashboardEarnFooterButton("/positions/yield-1/balance-1")
    ).toBe(false);
    expect(
      shouldRegisterDashboardEarnFooterButton(
        "/positions/yield-1/balance-1/stake"
      )
    ).toBe(false);
    expect(
      shouldRegisterDashboardEarnFooterButton(
        "/positions/yield-1/balance-1/stake/review"
      )
    ).toBe(false);
  });

  it("switches Unstake and Stake tabs without changing the URL", async () => {
    const app = await renderTabs([
      "/positions",
      "/positions/yield-1/balance-1",
    ]);

    await expect
      .element(app.getByTestId("position-details-action-tab-unstake"))
      .toBeInTheDocument();
    await expect
      .element(app.getByTestId("position-details-action-tab-stake"))
      .toBeInTheDocument();
    await expect
      .element(app.getByTestId("selected-mode"))
      .toHaveTextContent("unstake");
    await expect
      .element(app.getByTestId("location"))
      .toHaveTextContent("/positions/yield-1/balance-1");

    await userEvent.click(app.getByTestId("position-details-action-tab-stake"));

    await expect
      .element(app.getByTestId("selected-mode"))
      .toHaveTextContent("stake");
    await expect
      .element(app.getByTestId("location"))
      .toHaveTextContent("/positions/yield-1/balance-1");
  });

  it("does not render a selector when there is only one available action", async () => {
    const app = await render(
      <I18nextProvider i18n={i18nInstance}>
        <MemoryRouter initialEntries={["/positions/yield-1/balance-1"]}>
          <Routes>
            <Route
              path="positions/:integrationId/:balanceId"
              element={<ControlledTabs canUnstake={false} />}
            />
          </Routes>
        </MemoryRouter>
      </I18nextProvider>
    );

    await expect
      .element(app.getByTestId("position-details-action-tab-stake"))
      .not.toBeInTheDocument();
    await expect
      .element(app.getByTestId("position-details-action-tab-unstake"))
      .not.toBeInTheDocument();
  });
});
