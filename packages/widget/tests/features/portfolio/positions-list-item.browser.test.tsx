import type BigNumber from "bignumber.js";
import { act, type ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { exactDecimal } from "../../../src/domain/finance/exact";
import type { YieldId } from "../../../src/domain/identity/identifiers";
import type { InactiveValidatorStatus } from "../../../src/features/portfolio/state/read-models/position-list-item";
import type { PositionItem } from "../../../src/features/portfolio/state/read-models/positions";
import { PositionsListItem as CompactPositionsListItem } from "../../../src/features/portfolio/ui/compact/positions-page/components/positions-list-item";
import { PositionsListItem as DashboardPositionsListItem } from "../../../src/features/portfolio/ui/dashboard/positions/components/positions-list-item";
import { createWidgetI18nInstance } from "../../../src/services/translation/widget-translation";
import {
  type WidgetPresentation,
  WidgetPresentationProvider,
} from "../../../src/shared/react/widget-presentation";
import { yieldApiYieldFixture } from "../../fixtures";
import { render } from "../../utils/test-utils";

const frenchPresentation: WidgetPresentation = {
  hideNetworkLogo: false,
  hostTokenIconMapping: false,
  locale: "fr",
  mapNetworkIconUrl: () => undefined,
  mapTokenIconUrl: () => undefined,
};

const i18nInstance = createWidgetI18nInstance();

type RowDetails = {
  readonly integrationData: unknown;
  readonly providersDetails: unknown;
  readonly inactiveValidator: InactiveValidatorStatus | null;
  readonly rewardRateAverage: {
    readonly text: string;
    readonly isPositive: boolean;
  } | null;
  readonly hasHiddenBalance?: boolean;
  readonly totalFormatted: string | null;
  readonly totalAmountUsd: BigNumber | null;
};

const hookState = vi.hoisted(() => ({
  details: undefined as unknown as RowDetails,
  /** Per-Yield details, for a list of rows; others take `details`. */
  detailsByYield: new Map<string, RowDetails>(),
}));

vi.mock("../../../src/features/portfolio/react/use-position-list-item", () => ({
  usePositionListItem: (item: { integrationId: string }) =>
    hookState.detailsByYield.get(item.integrationId) ?? hookState.details,
}));

vi.mock(
  "../../../src/features/portfolio/ui/dashboard/positions/hooks/use-position-list-item",
  () => ({
    usePositionListItem: (item: { integrationId: string }) =>
      hookState.detailsByYield.get(item.integrationId) ?? hookState.details,
  })
);

const integrationData = yieldApiYieldFixture();

const createDetails = (overrides: Partial<RowDetails> = {}): RowDetails => ({
  integrationData,
  providersDetails: [
    { address: "0xvalidator-a", name: "Validator A" },
    { address: "0xvalidator-b", name: "Validator B" },
  ],
  inactiveValidator: null,
  rewardRateAverage: { text: "4.2%", isPositive: true },
  totalFormatted: `12.5 ${integrationData.token.symbol}`,
  totalAmountUsd: exactDecimal("25"),
  ...overrides,
});

const createItem = (
  overrides: Partial<
    Pick<
      PositionItem,
      | "actionRequired"
      | "hasPendingClaimRewards"
      | "hasPendingRequest"
      | "integrationId"
    >
  > = {}
): PositionItem => ({
  integrationId: integrationData.id as YieldId,
  balancesWithAmount: [],
  allBalances: [],
  balanceId: "default",
  actionRequired: false,
  hasPendingRequest: false,
  pointsRewardTokenBalances: [],
  hasPendingClaimRewards: false,
  total: [],
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
    name: "compact",
    row: (item: PositionItem) => <CompactPositionsListItem item={item} />,
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
  hookState.detailsByYield.clear();
});

/** A text's line boxes: one when it doesn't wrap. */
const lineCount = (element: Element) => {
  const range = document.createRange();
  range.selectNodeContents(element);
  return range.getClientRects().length;
};

/**
 * A Manage list as a 400px compact Widget holds it: rows of every status,
 * long names and long amounts. The list's inline size is the Widget's less
 * its 16px page insets.
 */
const manageRows = [
  {
    name: "Ether.fi Liquid Restaking Vault Extra Long Name",
    item: { actionRequired: true },
    value: "0.00107 ETH",
    fiat: exactDecimal("2.59"),
  },
  {
    name: "POL Native Staking",
    item: { hasPendingRequest: true },
    value: "12.34M POL",
    fiat: exactDecimal("1234567"),
  },
  {
    name: "Lido Ethereum Staking",
    item: { hasPendingClaimRewards: true },
    value: "<0.000001 ETH",
    fiat: null,
  },
  {
    name: "Cosmos Hub Native Staking",
    inactiveValidator: "jailed" as const,
    item: {},
    value: "1,234.56 ATOM",
    fiat: exactDecimal("5000"),
  },
  {
    name: "Resolv USDC vault",
    item: {},
    value: "1.2994 USDC",
    fiat: exactDecimal("1.3"),
  },
];

describe.each(presentations)("A $name Manage list", ({ row }) => {
  it("shows every row at one height, its value on one line", async () => {
    for (const [index, entry] of manageRows.entries()) {
      hookState.detailsByYield.set(
        `yield-${index}`,
        createDetails({
          integrationData: {
            ...integrationData,
            id: `yield-${index}`,
            metadata: { ...integrationData.metadata, name: entry.name },
          },
          inactiveValidator: entry.inactiveValidator ?? null,
          providersDetails: [{ address: "0xvalidator", name: "Luganodes" }],
          totalFormatted: entry.value,
          totalAmountUsd: entry.fiat,
        })
      );
    }
    const app = await renderRow(
      <div style={{ containerType: "inline-size", width: 368 }}>
        {manageRows.map((entry, index) => (
          <div key={entry.name}>
            {row(
              createItem({
                ...entry.item,
                integrationId: `yield-${index}` as YieldId,
              })
            )}
          </div>
        ))}
      </div>
    );

    await expect.element(app.getByText("Resolv USDC vault")).toBeVisible();
    const links = app.getByRole("link").elements();
    expect(links).toHaveLength(manageRows.length);

    const heights = links.map((link) =>
      Math.round(link.getBoundingClientRect().height)
    );
    expect(new Set(heights).size).toBe(1);

    for (const [index, entry] of manageRows.entries()) {
      const link = links[index];
      expect(link).toBeDefined();
      if (!link) continue;
      // Nothing spills past the row's edge.
      expect(link.scrollWidth).toBeLessThanOrEqual(link.clientWidth);

      const value = app.getByText(entry.value, { exact: true }).element();
      expect(lineCount(value)).toBe(1);
      expect(value.getBoundingClientRect().right).toBeLessThanOrEqual(
        link.getBoundingClientRect().right
      );
    }
  });

  it.each([
    { expected: "Action required", item: { actionRequired: true } },
    { expected: "Claim rewards", item: { hasPendingClaimRewards: true } },
    { expected: "In progress", item: { hasPendingRequest: true } },
  ])(
    "shows $expected on the provider line, under the title",
    async ({ expected, item }) => {
      hookState.details = createDetails();
      const app = await renderRow(
        <div style={{ containerType: "inline-size", width: 368 }}>
          {row(createItem(item))}
        </div>
      );

      const status = app.getByText(expected).element().getBoundingClientRect();
      const provider = app
        .getByText("via Validator A")
        .element()
        .getBoundingClientRect();
      const title = app
        .getByText(integrationData.metadata.name)
        .element()
        .getBoundingClientRect();

      expect(status.top).toBeGreaterThanOrEqual(title.bottom - 1);
      expect(
        Math.abs(
          status.top + status.height / 2 - (provider.top + provider.height / 2)
        )
      ).toBeLessThan(4);
      expect(status.left).toBeGreaterThan(provider.right);
    }
  );

  it("draws every status the Manage tab counts in one tone, apart from In progress", async () => {
    const statusRows = [
      { expected: "Action required", item: { actionRequired: true } },
      { expected: "Claim rewards", item: { hasPendingClaimRewards: true } },
      { expected: "Jailed", inactiveValidator: "jailed" as const, item: {} },
      { expected: "Inactive", inactiveValidator: "other" as const, item: {} },
      { expected: "In progress", item: { hasPendingRequest: true } },
    ];
    for (const [index, entry] of statusRows.entries()) {
      hookState.detailsByYield.set(
        `yield-${index}`,
        createDetails({
          integrationData: { ...integrationData, id: `yield-${index}` },
          inactiveValidator: entry.inactiveValidator ?? null,
        })
      );
    }
    const app = await renderRow(
      <div style={{ containerType: "inline-size", width: 368 }}>
        {statusRows.map((entry, index) => (
          <div key={entry.expected}>
            {row(
              createItem({
                ...entry.item,
                integrationId: `yield-${index}` as YieldId,
              })
            )}
          </div>
        ))}
      </div>
    );

    await expect.element(app.getByText("In progress")).toBeVisible();
    const colorOf = (text: string) =>
      getComputedStyle(app.getByText(text, { exact: true }).element()).color;
    const attention = colorOf("Action required");

    for (const counted of ["Claim rewards", "Jailed", "Inactive"]) {
      expect(colorOf(counted), counted).toBe(attention);
    }
    expect(colorOf("In progress")).not.toBe(attention);
  });
});

describe("Earn position list item", () => {
  describe.each(presentations)("$name", ({ name, row }) => {
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
      await expect.element(app.getByText("≈ $25.00")).toBeInTheDocument();
    });

    it("shows a total across tokens as its USD value alone", async () => {
      hookState.details = createDetails({
        totalAmountUsd: null,
        totalFormatted: "$1,005.00",
      });
      const app = await renderRow(row(createItem()));

      await expect.element(app.getByText("$1,005.00")).toBeInTheDocument();
      await expect.element(app.getByText(/≈/)).not.toBeInTheDocument();
    });

    it("keeps the value and its USD estimate in one column beside the APY", async () => {
      hookState.details = createDetails();
      const app = await renderRow(row(createItem()));

      await expect.element(app.getByText("≈ $25.00")).toBeInTheDocument();
      const value = app
        .getByText(`12.5 ${integrationData.token.symbol}`)
        .element();

      expect(app.getByText("≈ $25.00").element().parentElement).toBe(
        value.parentElement
      );
      if (name === "dashboard") {
        expect(app.getByText("4.2%").element().parentElement).not.toBe(
          value.parentElement
        );
      }
    });

    it("shows the USD estimate in the Widget language", async () => {
      hookState.details = createDetails({
        totalAmountUsd: exactDecimal("1234.5"),
      });
      const app = await renderRow(
        <WidgetPresentationProvider value={frenchPresentation}>
          {row(createItem())}
        </WidgetPresentationProvider>
      );

      // French puts U+00A0 before `$` and compacts thousands.
      await expect
        .element(app.getByText("≈ 1,23\u00a0k\u00a0$"))
        .toBeInTheDocument();
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
        inactiveValidator: "other",
        item: { hasPendingClaimRewards: true },
      },
      {
        expected: "Claim rewards",
        inactiveValidator: null,
        item: { hasPendingClaimRewards: true, hasPendingRequest: true },
      },
      {
        expected: "In progress",
        inactiveValidator: null,
        item: { hasPendingRequest: true },
      },
    ] as const)(
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
          "In progress",
        ].filter((label) => label !== expected)) {
          await expect.element(app.getByText(other)).not.toBeInTheDocument();
        }
      }
    );

    it.runIf(name === "dashboard")(
      "shows a positive rate in the success tone and an unavailable one muted",
      async () => {
        hookState.detailsByYield.set(
          "positive",
          createDetails({
            integrationData: { ...integrationData, id: "positive" },
            rewardRateAverage: { text: "4.2%", isPositive: true },
          })
        );
        hookState.detailsByYield.set(
          "unavailable",
          createDetails({
            integrationData: { ...integrationData, id: "unavailable" },
            rewardRateAverage: { text: "—", isPositive: false },
          })
        );
        // Wide enough for the rate, which a narrow row leaves out.
        const app = await renderRow(
          <div style={{ containerType: "inline-size", width: 640 }}>
            {row(createItem({ integrationId: "positive" as YieldId }))}
            {row(createItem({ integrationId: "unavailable" as YieldId }))}
          </div>
        );

        await expect.element(app.getByText("—")).toBeVisible();
        const colorOf = (text: string) =>
          getComputedStyle(app.getByText(text, { exact: true }).element())
            .color;
        const muted = getComputedStyle(
          app.getByText("via Validator A").first().element()
        ).color;

        expect(colorOf("—")).toBe(muted);
        expect(colorOf("4.2%")).not.toBe(muted);
        expect(colorOf("4.2%")).not.toBe(
          getComputedStyle(
            app.getByText(integrationData.metadata.name).first().element()
          ).color
        );
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
    await dashboard.unmount();

    const compact = await renderRow(presentations[0].row(createItem()));

    await expect
      .element(compact.getByText(integrationData.metadata.name))
      .toBeInTheDocument();
    await expect.element(compact.getByText("4.2%")).not.toBeInTheDocument();
  });

  it("shows a dash for a missing amount only in the dashboard", async () => {
    hookState.details = createDetails({ totalFormatted: null });
    const dashboard = await renderRow(presentations[1].row(createItem()));

    await expect
      .element(dashboard.getByText("—", { exact: true }))
      .toBeInTheDocument();
    await dashboard.unmount();

    const compact = await renderRow(presentations[0].row(createItem()));

    await expect
      .element(compact.getByText(integrationData.metadata.name))
      .toBeInTheDocument();
    await expect
      .element(compact.getByText("—", { exact: true }))
      .not.toBeInTheDocument();
  });

  it.each(presentations)(
    "shows Hidden for a hidden $name position without a total",
    async ({ row }) => {
      hookState.details = createDetails({
        hasHiddenBalance: true,
        totalFormatted: null,
      });
      const app = await renderRow(row(createItem()));

      await expect.element(app.getByText("Hidden")).toBeInTheDocument();
      await expect
        .element(app.getByText("—", { exact: true }))
        .not.toBeInTheDocument();
    }
  );

  it.each([
    { expected: false, presentation: presentations[0] },
    { expected: true, presentation: presentations[1] },
  ])(
    "opens $presentation.name position details with view transition: $expected",
    async ({ expected, presentation }) => {
      hookState.details = createDetails();
      const startViewTransition = vi
        .spyOn(document, "startViewTransition")
        .mockImplementation(
          (
            update?: ViewTransitionUpdateCallback | StartViewTransitionOptions
          ) => {
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
          }
        );

      const app = await renderRow(presentation.row(createItem()));
      const link = app.getByRole("link");
      await expect.element(link).toBeInTheDocument();
      await act(async () => (link.element() as HTMLElement).click());

      await expect.element(app.getByText("Details page")).toBeInTheDocument();
      expect(startViewTransition.mock.calls.length > 0).toBe(expected);
    }
  );
});
