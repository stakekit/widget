import { I18nextProvider } from "react-i18next";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { shouldRegisterDashboardEarnFooterButton } from "../../src/app/routes/dashboard-routes";
import { PositionDetailsActionTabs } from "../../src/features/position-details/ui/dashboard/components/position-details-action-tabs";
import { i18nInstance } from "../../src/translation";
import { render } from "../utils/test-utils";

const LocationProbe = () => {
  const location = useLocation();

  return <div data-testid="location">{location.pathname}</div>;
};

const BackProbe = () => {
  const navigate = useNavigate();

  return (
    <button data-testid="back" onClick={() => navigate(-1)} type="button">
      Back
    </button>
  );
};

const renderTabs = (initialEntries: string | string[]) => {
  const entries = Array.isArray(initialEntries)
    ? initialEntries
    : [initialEntries];

  return render(
    <I18nextProvider i18n={i18nInstance}>
      <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}>
        <LocationProbe />

        <Routes>
          <Route path="positions">
            <Route index element={<div data-testid="route-kind">manage</div>} />
            <Route
              path="borrow/:marketId"
              element={<div data-testid="route-kind">borrow position</div>}
            />
            <Route
              path=":integrationId/:balanceId"
              element={
                <>
                  <PositionDetailsActionTabs canStake canUnstake />
                  <BackProbe />
                </>
              }
            />
            <Route
              path=":integrationId/:balanceId/unstake"
              element={
                <>
                  <PositionDetailsActionTabs canStake canUnstake />
                  <BackProbe />
                </>
              }
            />
          </Route>
        </Routes>
      </MemoryRouter>
    </I18nextProvider>
  );
};

describe("position details action tabs", () => {
  it("matches the Manage index and prefers borrow over generic position details", async () => {
    const manage = await renderTabs("/positions");

    await expect
      .element(manage.getByTestId("route-kind"))
      .toHaveTextContent("manage");

    await manage.unmount();

    const borrowPosition = await renderTabs("/positions/borrow/market-1");

    await expect
      .element(borrowPosition.getByTestId("route-kind"))
      .toHaveTextContent("borrow position");
  });

  it("registers the earn CTA only for stake form routes", () => {
    expect(shouldRegisterDashboardEarnFooterButton("/")).toBe(true);
    expect(
      shouldRegisterDashboardEarnFooterButton("/positions/yield-1/balance-1")
    ).toBe(true);
    expect(
      shouldRegisterDashboardEarnFooterButton(
        "/positions/yield-1/balance-1/stake"
      )
    ).toBe(true);

    expect(shouldRegisterDashboardEarnFooterButton("/review")).toBe(false);
    expect(shouldRegisterDashboardEarnFooterButton("/steps")).toBe(false);
    expect(
      shouldRegisterDashboardEarnFooterButton(
        "/positions/yield-1/balance-1/stake/review"
      )
    ).toBe(false);
  });

  it("renders Stake and Unstake tabs without adding tab changes to history", async () => {
    const app = await renderTabs([
      "/positions",
      "/positions/yield-1/balance-1",
    ]);

    await expect
      .element(app.getByTestId("position-details-action-tab-stake"))
      .toBeInTheDocument();
    await expect
      .element(app.getByTestId("position-details-action-tab-unstake"))
      .toBeInTheDocument();
    await expect
      .element(app.getByTestId("location"))
      .toHaveTextContent("/positions/yield-1/balance-1");

    await userEvent.click(
      app.getByTestId("position-details-action-tab-unstake")
    );

    await expect
      .element(app.getByTestId("location"))
      .toHaveTextContent("/positions/yield-1/balance-1/unstake");

    await userEvent.click(app.getByTestId("back"));

    await expect
      .element(app.getByTestId("location"))
      .toHaveTextContent("/positions");
  });

  it("does not render a selector when there is only one available action", async () => {
    const app = await render(
      <I18nextProvider i18n={i18nInstance}>
        <MemoryRouter initialEntries={["/positions/yield-1/balance-1"]}>
          <Routes>
            <Route
              path="positions/:integrationId/:balanceId"
              element={
                <PositionDetailsActionTabs canStake canUnstake={false} />
              }
            />
          </Routes>
        </MemoryRouter>
      </I18nextProvider>
    );

    expect(app.container.textContent).not.toContain("Stake");
    expect(app.container.textContent).not.toContain("Unstake");
  });
});
