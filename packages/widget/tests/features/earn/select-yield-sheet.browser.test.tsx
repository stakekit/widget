import { I18nextProvider } from "react-i18next";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import type { EarnYieldWithProvider } from "../../../src/domain/earn/models";
import { SelectYield } from "../../../src/features/earn/ui/components/select-yield-section/select-yield";
import { createWidgetI18nInstance } from "../../../src/services/translation/widget-translation";
import { yieldApiYieldFixture } from "../../fixtures";
import { render } from "../../utils/test-utils";
import { TestWidgetConfigProvider } from "../../utils/widget-config-provider";

const i18nInstance = createWidgetI18nInstance();

const hookState = vi.hoisted(() => ({
  filtered: [] as ReadonlyArray<EarnYieldWithProvider>,
}));

vi.mock(
  "../../../src/features/earn/react/use-earn-facades",
  async (importOriginal) => {
    const actual = await importOriginal<object>();
    return {
      ...actual,
      useEarnYieldSelection: () => ({
        select: vi.fn(),
        selectCategory: vi.fn(),
        setSearch: vi.fn(),
        view: {
          filtered: hookState.filtered,
          search: "",
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
}: {
  readonly id: string;
  readonly name: string;
  readonly rateType: "APY" | "APR";
  readonly total: number;
  readonly type: "staking" | "lending";
}): EarnYieldWithProvider => {
  const fixture = yieldApiYieldFixture({
    id,
    rewardRate: { rateType, total },
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
});
