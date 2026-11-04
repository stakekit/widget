import { useState } from "react";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { shouldRegisterDashboardEarnFooterButton } from "../../../src/app/layouts/dashboard/dashboard-routes";
import type { EarnYieldWithProvider } from "../../../src/domain/earn/models";
import type { PositionDetailsActionMode } from "../../../src/features/position-details/model/hub";
import { PositionDetailsActionTabs } from "../../../src/features/position-details/ui/dashboard/components/position-details-action-tabs";
import { createWidgetI18nInstance } from "../../../src/services/translation/widget-translation";
import { yieldApiYieldDtoFixture, yieldApiYieldFixture } from "../../fixtures";
import { render } from "../../utils/test-utils";

const i18nInstance = createWidgetI18nInstance();

const LocationProbe = () => {
  const location = useLocation();

  return <div data-testid="location">{location.pathname}</div>;
};

const vaultYield = yieldApiYieldFixture({
  mechanics: { ...yieldApiYieldDtoFixture().mechanics, type: "vault" },
});

const ControlledTabs = ({
  canEnter = true,
  canExit = true,
  integration = yieldApiYieldFixture(),
}: {
  canEnter?: boolean;
  canExit?: boolean;
  integration?: EarnYieldWithProvider;
}) => {
  const [selectedMode, setSelectedMode] =
    useState<PositionDetailsActionMode>("exit");

  return (
    <>
      <PositionDetailsActionTabs
        canEnter={canEnter}
        canExit={canExit}
        integration={integration}
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
      shouldRegisterDashboardEarnFooterButton("/positions/yield-1/default")
    ).toBe(false);
    expect(
      shouldRegisterDashboardEarnFooterButton(
        "/positions/yield-1/default/stake"
      )
    ).toBe(false);
    expect(
      shouldRegisterDashboardEarnFooterButton(
        "/positions/yield-1/default/stake/review"
      )
    ).toBe(false);
  });

  it("switches the Unstake and Stake tabs without changing the URL", async () => {
    const app = await renderTabs(["/positions", "/positions/yield-1/default"]);

    await expect
      .element(app.getByRole("tab", { name: "Unstake" }))
      .toHaveAttribute("aria-selected", "true");
    await expect
      .element(app.getByRole("tab", { name: "Stake" }))
      .toHaveAttribute("aria-selected", "false");
    await expect
      .element(app.getByTestId("selected-mode"))
      .toHaveTextContent("exit");
    await expect
      .element(app.getByTestId("location"))
      .toHaveTextContent("/positions/yield-1/default");

    await userEvent.click(app.getByRole("tab", { name: "Stake" }));

    await expect
      .element(app.getByTestId("selected-mode"))
      .toHaveTextContent("enter");
    await expect
      .element(app.getByRole("tab", { name: "Stake" }))
      .toHaveAttribute("aria-selected", "true");
    await expect
      .element(app.getByTestId("location"))
      .toHaveTextContent("/positions/yield-1/default");
  });

  it("names the tabs Withdraw and Deposit for a vault", async () => {
    const app = await render(
      <I18nextProvider i18n={i18nInstance}>
        <MemoryRouter>
          <ControlledTabs integration={vaultYield} />
        </MemoryRouter>
      </I18nextProvider>
    );

    await expect
      .element(app.getByRole("tab", { name: "Withdraw" }))
      .toBeInTheDocument();
    await expect
      .element(app.getByRole("tab", { name: "Deposit" }))
      .toBeInTheDocument();
  });

  it("does not render a selector when there is only one available action", async () => {
    const app = await render(
      <I18nextProvider i18n={i18nInstance}>
        <MemoryRouter initialEntries={["/positions/yield-1/default"]}>
          <Routes>
            <Route
              path="positions/:integrationId/:balanceId"
              element={<ControlledTabs canExit={false} />}
            />
          </Routes>
        </MemoryRouter>
      </I18nextProvider>
    );

    await expect.element(app.getByRole("tablist")).not.toBeInTheDocument();
  });
});
