import { I18nextProvider } from "react-i18next";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router";
import { userEvent } from "vitest/browser";
import { shouldRegisterDashboardEarnFooterButton } from "../../src/Dashboard";
import { getPositionDetailsStakeReviewPath } from "../../src/hooks/navigation/use-position-details-stake-match";
import { PositionDetailsActionTabs } from "../../src/pages-dashboard/position-details/components/position-details-action-tabs";
import { i18nInstance } from "../../src/translation";
import { describe, expect, it } from "../utils/test-extend";
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
          <Route path="manage" element={null} />

          <Route
            path="positions/:integrationId/:balanceId"
            element={
              <>
                <PositionDetailsActionTabs canStake canUnstake />
                <BackProbe />
              </>
            }
          />
          <Route
            path="positions/:integrationId/:balanceId/unstake"
            element={
              <>
                <PositionDetailsActionTabs canStake canUnstake />
                <BackProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>
  );
};

describe("position details action tabs", () => {
  it("builds the nested stake review path from position route params", () => {
    expect(
      getPositionDetailsStakeReviewPath({
        balanceId: "balance-1",
        integrationId: "yield-1",
      })
    ).toBe("/positions/yield-1/balance-1/stake/review");

    expect(
      getPositionDetailsStakeReviewPath({
        balanceId: "balance-1",
      })
    ).toBeNull();
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
    const app = await renderTabs(["/manage", "/positions/yield-1/balance-1"]);

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
      .toHaveTextContent("/manage");
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
