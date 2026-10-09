import { act, type ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { YieldId } from "../../src/domain/identity/identifiers";
import type { PositionItem } from "../../src/features/portfolio/state/read-models/positions";
import { PositionsListItem as ClassicPositionsListItem } from "../../src/features/portfolio/ui/classic/positions-page/components/positions-list-item";
import { PositionsListItem as DashboardPositionsListItem } from "../../src/features/portfolio/ui/dashboard/positions/components/positions-list-item";
import { createWidgetI18nInstance } from "../../src/services/translation/widget-translation";
import { yieldApiYieldFixture } from "../fixtures";
import { render } from "../utils/test-utils";

const i18nInstance = createWidgetI18nInstance();

type RowDetails = {
  readonly integrationData: unknown;
  readonly providersDetails: unknown;
  readonly inactiveValidator: string | null;
  readonly rewardRateAverage: string | null;
  readonly totalAmountFormatted: string | null;
  readonly totalAmountPriceFormatted: string | null;
};

const hookState = vi.hoisted(() => ({
  details: undefined as unknown as RowDetails,
}));

vi.mock(
  "../../src/features/portfolio/ui/classic/positions-page/hooks/use-position-list-item",
  () => ({ usePositionListItem: () => hookState.details })
);

vi.mock(
  "../../src/features/portfolio/ui/dashboard/positions/hooks/use-position-list-item",
  () => ({ usePositionListItem: () => hookState.details })
);

const integrationData = yieldApiYieldFixture();

const createDetails = (overrides: Partial<RowDetails> = {}): RowDetails => ({
  integrationData,
  providersDetails: [
    { address: "0xvalidator-a", name: "Validator A" },
    { address: "0xvalidator-b", name: "Validator B" },
  ],
  inactiveValidator: null,
  rewardRateAverage: "4.2%",
  totalAmountFormatted: "12.5",
  totalAmountPriceFormatted: "25",
  ...overrides,
});

const createItem = (
  overrides: Partial<
    Pick<PositionItem, "actionRequired" | "hasPendingClaimRewards">
  > = {}
): PositionItem => ({
  integrationId: integrationData.id as YieldId,
  balancesWithAmount: [],
  allBalances: [],
  balanceId: "balance-1",
  actionRequired: false,
  pointsRewardTokenBalances: [],
  hasPendingClaimRewards: false,
  token: integrationData.token,
  yieldLabelDto: null,
  type: "default",
  ...overrides,
});

const renderRow = (row: ReactNode) => {
  const router = createMemoryRouter(
    [
      { path: "/positions", element: row },
      { path: "/positions/:yieldId/:balanceId", element: <p>Details page</p> },
    ],
    { initialEntries: ["/positions"] }
  );

  return render(
    <I18nextProvider i18n={i18nInstance}>
      <RouterProvider router={router} />
    </I18nextProvider>
  );
};

const presentations = [
  {
    name: "classic",
    row: (item: PositionItem) => <ClassicPositionsListItem item={item} />,
  },
  {
    name: "dashboard",
    row: (item: PositionItem) => (
      <DashboardPositionsListItem item={{ kind: "earn", position: item }} />
    ),
  },
] as const;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Earn position list item", () => {
  describe.each(presentations)("$name", ({ row }) => {
    it("shows the position name, provider line, and amounts", async () => {
      hookState.details = createDetails();
      const app = await renderRow(row(createItem()));

      await expect
        .element(app.getByText(integrationData.metadata.name))
        .toBeInTheDocument();
      await expect
        .element(app.getByText("via Validator A"))
        .toBeInTheDocument();
      await expect
        .element(app.getByText(`12.5 ${integrationData.token.symbol}`))
        .toBeInTheDocument();
      await expect.element(app.getByText("≈ $25")).toBeInTheDocument();
    });

    it.each([
      {
        expected: "Action required",
        inactiveValidator: "jailed",
        item: { actionRequired: true, hasPendingClaimRewards: true },
      },
      {
        expected: "Jailed",
        inactiveValidator: "jailed",
        item: { hasPendingClaimRewards: true },
      },
      {
        expected: "Inactive",
        inactiveValidator: "inactive",
        item: { hasPendingClaimRewards: true },
      },
      {
        expected: "Claim rewards",
        inactiveValidator: null,
        item: { hasPendingClaimRewards: true },
      },
    ])(
      "shows the $expected badge first",
      async ({ expected, inactiveValidator, item }) => {
        hookState.details = createDetails({ inactiveValidator });
        const app = await renderRow(row(createItem(item)));

        await expect.element(app.getByText(expected)).toBeInTheDocument();
        for (const other of [
          "Action required",
          "Jailed",
          "Inactive",
          "Claim rewards",
        ].filter((label) => label !== expected)) {
          await expect.element(app.getByText(other)).not.toBeInTheDocument();
        }
      }
    );

    it("shows no action badge without a pending action", async () => {
      hookState.details = createDetails();
      const app = await renderRow(row(createItem()));

      await expect
        .element(app.getByText(integrationData.metadata.name))
        .toBeInTheDocument();
      await expect
        .element(app.getByText("Claim rewards"))
        .not.toBeInTheDocument();
    });
  });

  it("shows the reward rate only in the dashboard", async () => {
    hookState.details = createDetails();
    const dashboard = await renderRow(presentations[1].row(createItem()));

    await expect.element(dashboard.getByText("4.2%")).toBeInTheDocument();
    dashboard.unmount();

    const classic = await renderRow(presentations[0].row(createItem()));

    await expect
      .element(classic.getByText(integrationData.metadata.name))
      .toBeInTheDocument();
    await expect.element(classic.getByText("4.2%")).not.toBeInTheDocument();
  });

  it("shows a dash for a missing amount only in the dashboard", async () => {
    hookState.details = createDetails({ totalAmountFormatted: null });
    const dashboard = await renderRow(presentations[1].row(createItem()));

    await expect
      .element(dashboard.getByText("-", { exact: true }))
      .toBeInTheDocument();
    dashboard.unmount();

    const classic = await renderRow(presentations[0].row(createItem()));

    await expect
      .element(classic.getByText(integrationData.metadata.name))
      .toBeInTheDocument();
    await expect
      .element(classic.getByText("-", { exact: true }))
      .not.toBeInTheDocument();
  });

  it.each([
    { expected: false, presentation: presentations[0] },
    { expected: true, presentation: presentations[1] },
  ])(
    "opens $presentation.name position details with view transition: $expected",
    async ({ expected, presentation }) => {
      hookState.details = createDetails();
      const startViewTransition = vi
        .spyOn(document, "startViewTransition")
        .mockImplementation((update) => {
          const done = Promise.resolve(
            typeof update === "function" ? update() : update?.update?.()
          );

          return {
            finished: done,
            ready: done,
            skipTransition: () => undefined,
            types: new Set(),
            updateCallbackDone: done,
          } as unknown as ViewTransition;
        });

      const app = await renderRow(presentation.row(createItem()));
      const link = app.getByRole("link");
      await expect.element(link).toBeInTheDocument();
      await act(async () => (link.element() as HTMLElement).click());

      await expect.element(app.getByText("Details page")).toBeInTheDocument();
      expect(startViewTransition.mock.calls.length > 0).toBe(expected);
    }
  );
});
