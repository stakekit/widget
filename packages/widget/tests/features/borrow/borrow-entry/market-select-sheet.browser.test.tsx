import { I18nextProvider } from "react-i18next";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import { MarketSelectSheet } from "../../../../src/features/borrow/borrow-entry/ui/components/market-select-sheet";
import { createWidgetI18nInstance } from "../../../../src/services/translation/widget-translation";
import {
  makeBorrowCollateralTokenDto,
  makeBorrowIntegration,
  makeBorrowMarket,
} from "../../../fixtures/borrow";
import { render } from "../../../utils/test-utils";
import { TestWidgetConfigProvider } from "../../../utils/widget-config-provider";

const i18nInstance = createWidgetI18nInstance();

/** A logo that loads without the network, told apart by its colour. */
const logo = (fill: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="${fill}"/></svg>`
  )}`;

const logos = {
  aave: logo("#b6509e"),
  lbtc: logo("#00ff00"),
  morpho: logo("#2470ff"),
  usdc: logo("#2775ca"),
  wbtc: logo("#f09242"),
  wsteth: logo("#00a3ff"),
} as const;

const token = (symbol: string, address: string, logoURI: string) => ({
  address,
  decimals: 8,
  logoURI,
  name: symbol,
  symbol,
});

const wbtc = token(
  "WBTC",
  "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
  logos.wbtc
);
const usdc = token(
  "USDC",
  "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  logos.usdc
);
const wsteth = token(
  "wstETH",
  "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0",
  logos.wsteth
);
const lbtc = token(
  "LBTC",
  "0x8236a87084f8B84306f72007F36F2618A5634494",
  logos.lbtc
);

const collateral = (collateralToken: ReturnType<typeof token>) =>
  makeBorrowCollateralTokenDto({ supplyRate: "0", token: collateralToken });

const market = ({
  borrowRate,
  collateralTokens,
  id,
  integrationId,
  loanToken,
  type,
}: {
  readonly borrowRate: string;
  readonly collateralTokens: ReadonlyArray<ReturnType<typeof collateral>>;
  readonly id: string;
  readonly integrationId: string;
  readonly loanToken: ReturnType<typeof token>;
  readonly type: "pool" | "isolated";
}) =>
  makeBorrowMarket({
    availableLiquidityRaw: "50000000000000",
    borrowRate,
    collateralTokens,
    id,
    integrationId,
    loanToken,
    totalBorrowRaw: "50000000000000",
    totalSupplyRaw: "100000000000000",
    type,
  });

const integrations = [
  { id: "aave-borrow", logoURI: logos.aave, name: "Aave V3" },
  { id: "morpho-borrow", logoURI: logos.morpho, name: "Morpho Blue" },
].map(({ id, logoURI, name }) =>
  makeBorrowIntegration({
    id,
    metadata: {
      description: name,
      externalLink: "https://example.com",
      logoURI,
    },
    name,
  })
);

const markets = [
  market({
    borrowRate: "0.0031",
    collateralTokens: [collateral(wsteth), collateral(lbtc)],
    id: "aave-wbtc",
    integrationId: "aave-borrow",
    loanToken: wbtc,
    type: "pool",
  }),
  market({
    borrowRate: "0.0002",
    collateralTokens: [collateral(wsteth)],
    id: "morpho-wsteth-wbtc",
    integrationId: "morpho-borrow",
    loanToken: wbtc,
    type: "isolated",
  }),
  market({
    borrowRate: "0.0274",
    collateralTokens: [collateral(lbtc)],
    id: "morpho-lbtc-wbtc",
    integrationId: "morpho-borrow",
    loanToken: wbtc,
    type: "isolated",
  }),
  market({
    borrowRate: "0.05",
    collateralTokens: [collateral(wsteth)],
    id: "morpho-wsteth-usdc",
    integrationId: "morpho-borrow",
    loanToken: usdc,
    type: "isolated",
  }),
];

const imageSources = (element: Element) =>
  [...element.querySelectorAll("img")].map((image) => image.src);

/** The group header: the nearest ancestor of its label holding an avatar. */
const headerOf = (label: Element) => {
  let element = label.parentElement;
  while (element && element.querySelector("img") === null) {
    element = element.parentElement;
  }
  if (!element) throw new Error("No group header");
  return element;
};

describe("borrow market select sheet", () => {
  it("heads each lent token's group with its avatar and best rate, and tells rows apart by collateral or provider", async () => {
    const app = await render(
      <I18nextProvider i18n={i18nInstance}>
        <TestWidgetConfigProvider
          apiKey="test-key"
          baseUrl="https://api.example.com"
          variant="default"
          yieldsApiUrl="https://yield.example.com"
        >
          <MarketSelectSheet
            integrations={integrations}
            markets={markets}
            selectedMarketId={markets[0]?.id ?? null}
          />
        </TestWidgetConfigProvider>
      </I18nextProvider>
    );

    await userEvent.click(app.getByTestId("borrow-market-select"));
    const sheet = page.getByTestId("select-modal__container");
    await expect.element(sheet).toBeVisible();

    // The header names the lent token in normal case, beside its logo, with
    // the group's best rate at its end.
    const wbtcLabel = sheet.getByText("WBTC", { exact: true }).first();
    await expect.element(wbtcLabel).toBeVisible();
    expect(getComputedStyle(wbtcLabel.element()).textTransform).toBe("none");
    const wbtcHeader = headerOf(wbtcLabel.element());
    expect(wbtcHeader.textContent).toContain("from 0.02%");
    await expect.poll(() => imageSources(wbtcHeader)).toContain(logos.wbtc);

    // A group of one market shows its rate without "from".
    const usdcHeader = headerOf(
      sheet.getByText("USDC", { exact: true }).first().element()
    );
    expect(usdcHeader.textContent).toContain("5.00%");
    expect(usdcHeader.textContent).not.toContain("from");

    const row = (id: string) =>
      sheet.getByTestId(`borrow-market-select__item_${id}`).element();

    // Rows no longer repeat the lent token: isolated markets show their
    // collateral, the pool its provider.
    await expect
      .poll(() => imageSources(row("morpho-wsteth-wbtc")))
      .toContain(logos.wsteth);
    await expect
      .poll(() => imageSources(row("morpho-lbtc-wbtc")))
      .toContain(logos.lbtc);
    await expect
      .poll(() => imageSources(row("aave-wbtc")))
      .toContain(logos.aave);
    for (const id of ["aave-wbtc", "morpho-wsteth-wbtc", "morpho-lbtc-wbtc"]) {
      expect(imageSources(row(id))).not.toContain(logos.wbtc);
    }
  });
});
