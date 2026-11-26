import { I18nextProvider } from "react-i18next";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import type { EarnYieldWithProvider } from "../../../src/domain/earn/yield-schema";
import type { YieldSort } from "../../../src/domain/earn/yield-sort";
import { SelectYield } from "../../../src/features/earn/ui/components/select-yield-section/select-yield";
import { createWidgetI18nInstance } from "../../../src/services/translation/widget-translation";
import { yieldApiYieldFixture } from "../../fixtures";
import { render } from "../../utils/test-utils";
import { TestWidgetConfigProvider } from "../../utils/widget-config-provider";

const i18nInstance = createWidgetI18nInstance();

const hookState = vi.hoisted(() => ({
  filtered: [] as ReadonlyArray<EarnYieldWithProvider>,
  sort: "recommended" as YieldSort,
  select: vi.fn<(id: string) => void>(),
  setSort: vi.fn<(sort: YieldSort) => void>(),
}));

vi.mock(
  "../../../src/features/earn/ui/use-earn-facades",
  async (importOriginal) => {
    const actual = await importOriginal<object>();
    return {
      ...actual,
      useEarnYieldSelection: () => ({
        select: hookState.select,
        selectCategory: vi.fn(),
        setSearch: vi.fn(),
        setSort: hookState.setSort,
        view: {
          campaigns: new Map(),
          filtered: hookState.filtered,
          search: "",
          sort: hookState.sort,
          selected: hookState.filtered[0] ?? null,
        },
      }),
    };
  }
);

const baseYield = yieldApiYieldFixture();

const yieldOf = ({
  id,
  name,
  rateType,
  total,
  type,
  risk,
}: {
  readonly id: string;
  readonly name: string;
  readonly rateType: "APY" | "APR";
  readonly total: number;
  readonly type: "staking" | "lending";
  readonly risk?: {
    readonly rating: string;
    readonly source: "credora" | "stakingRewards";
  };
}): EarnYieldWithProvider => {
  const fixture = yieldApiYieldFixture({
    id,
    rewardRate: { rateType, total },
    ...(risk ? { risk: { ratings: [risk] } } : {}),
  });

  return {
    ...fixture,
    metadata: { ...fixture.metadata, name },
    mechanics: { ...baseYield.mechanics, type },
  };
};

const renderSheet = async () => {
  const app = await render(
    <I18nextProvider i18n={i18nInstance}>
      <TestWidgetConfigProvider
        apiKey="test-key"
        baseUrl="https://api.example.com"
        variant="default"
        yieldsApiUrl="https://yield.example.com"
      >
        <SelectYield />
      </TestWidgetConfigProvider>
    </I18nextProvider>
  );

  await userEvent.click(app.getByTestId("select-opportunity"));
  await expect
    .element(page.getByTestId("select-modal__container"))
    .toBeVisible();

  return app;
};

const row = (id: string) =>
  page.getByTestId(new RegExp(`^select-opportunity__item_${id}-`));

/** The element showing exactly `text` inside the option `id`. */
const leafWithText = (id: string, text: string) => {
  const leaf = [...row(id).element().querySelectorAll("*")].find(
    (element) =>
      element.children.length === 0 && element.textContent?.trim() === text
  );
  if (!leaf) throw new Error(`No "${text}" in ${id}`);
  return leaf;
};

const lineCount = (element: Element) => {
  const range = document.createRange();
  range.selectNodeContents(element);
  const tops = new Set(
    [...range.getClientRects()].map((rect) => Math.round(rect.top))
  );
  return tops.size;
};

beforeEach(async () => {
  await page.viewport(360, 800);
});

afterEach(() => {
  hookState.filtered = [];
  hookState.sort = "recommended";
  hookState.select.mockReset();
  hookState.setSort.mockReset();
});

describe("select yield sheet", () => {
  it("heads a group with the rate type all its rows share and keeps rates on one line", async () => {
    hookState.filtered = [
      yieldOf({
        id: "staking-a",
        name: "Simply Staking: Premium Pooled ETH Staking With A Long Name",
        rateType: "APY",
        total: 0,
        type: "staking",
      }),
      yieldOf({
        id: "staking-b",
        name: "Meria Pooled ETH Staking",
        rateType: "APY",
        total: 0.0186,
        type: "staking",
      }),
      yieldOf({
        id: "lending-a",
        name: "Aave Lending",
        rateType: "APY",
        total: 0.03,
        type: "lending",
      }),
      yieldOf({
        id: "lending-b",
        name: "Compound Lending",
        rateType: "APR",
        total: 0.04,
        type: "lending",
      }),
    ];

    await renderSheet();

    // The staking group shares APY: its header says it once, the rows don't.
    await expect.element(row("staking-a")).toBeVisible();
    const sheet = page.getByTestId("select-modal__container");
    expect(row("staking-a").element().textContent).not.toContain("APY");
    expect(row("staking-b").element().textContent).not.toContain("APY");

    // The lending group mixes rate types, so each row keeps its own label:
    // its type alone, with no period it averages over.
    expect(leafWithText("lending-a", "APY")).toBeTruthy();
    expect(leafWithText("lending-b", "APR")).toBeTruthy();
    const header = sheet.getByText("APY", { exact: true }).elements()[0];
    expect(sheet.getByText("APY", { exact: true }).elements()).toHaveLength(2);

    // The header's rate type and the rates share one right edge, on the
    // chosen row and the others alike.
    const right = (element: Element | undefined) =>
      Math.round(element?.getBoundingClientRect().right ?? Number.NaN);
    expect(right(leafWithText("staking-a", "—"))).toBe(right(header));
    expect(right(leafWithText("staking-b", "1.86%"))).toBe(right(header));

    // A missing rate beside a long name stays on one line.
    expect(lineCount(leafWithText("staking-a", "—"))).toBe(1);
    expect(lineCount(leafWithText("staking-b", "1.86%"))).toBe(1);
  });

  it("lists a sorted list as one run, without type headers, and changes the sort", async () => {
    hookState.sort = "rewardRate";
    hookState.filtered = [
      yieldOf({
        id: "lending-a",
        name: "Aave Lending",
        rateType: "APY",
        total: 0.06,
        type: "lending",
      }),
      yieldOf({
        id: "staking-a",
        name: "Lido Staking",
        rateType: "APY",
        total: 0.03,
        type: "staking",
      }),
    ];

    await renderSheet();

    const sheet = page.getByTestId("select-modal__container");
    await expect.element(row("lending-a")).toBeVisible();
    await expect.element(row("staking-a")).toBeVisible();
    // The recommended order heads each type's run; a sort lists one run.
    await expect
      .element(sheet.getByText("Lending", { exact: true }))
      .not.toBeInTheDocument();

    // The sort button beside the search field names the sort it applies.
    const sortControl = sheet.getByRole("combobox", {
      name: "Sort yields: Highest rate",
    });
    await expect.element(sortControl).toBeVisible();
    await userEvent.click(sortControl);
    await userEvent.click(page.getByRole("option", { name: "Lowest risk" }));

    expect(hookState.setSort).toHaveBeenCalledWith("risk");
  });

  it("names the rater of a risk rating on hover and to screen readers", async () => {
    hookState.filtered = [
      yieldOf({
        id: "rated",
        name: "Morpho USDC Vault",
        rateType: "APY",
        total: 0.05,
        type: "lending",
        risk: { rating: "A", source: "credora" },
      }),
    ];

    await renderSheet();

    // The row names the rater to screen readers; the tooltip only repeats it.
    await expect.element(row("rated")).toBeVisible();
    expect(row("rated").element().textContent).toContain("Rated by Credora");
    await userEvent.hover(row("rated").getByText("Risk A", { exact: true }));

    const tooltip = () =>
      page
        .getByText("Rated by Credora", { exact: true })
        .elements()
        .find(
          (element) =>
            !row("rated").element().contains(element) &&
            element.checkVisibility()
        );
    await expect.poll(() => tooltip() !== undefined).toBe(true);

    // A press on the hint is not a press on its row.
    const hint = tooltip();
    if (!hint) throw new Error("No risk rater hint");
    await userEvent.click(hint);
    expect(hookState.select).not.toHaveBeenCalled();
    await expect
      .element(page.getByTestId("select-modal__container"))
      .toBeVisible();
  });
});
