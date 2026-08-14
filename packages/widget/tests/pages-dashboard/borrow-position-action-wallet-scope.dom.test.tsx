import { RegistryProvider } from "@effect/atom-react";
import * as Schema from "effect/Schema";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import type { TFunction } from "i18next";
import { act } from "react";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter, Outlet, Route, Routes } from "react-router";
import { describe, expect, it } from "vitest";
import { Integration } from "../../src/domain/borrow/catalog/integration";
import { Market } from "../../src/domain/borrow/catalog/market";
import { BorrowAccountSnapshot } from "../../src/domain/borrow/positions/borrow-account-snapshot";
import { deriveBorrowPositions } from "../../src/domain/borrow/positions/borrow-positions";
import { WalletAddress } from "../../src/domain/identity/identifiers";
import {
  type BorrowPositionAction,
  getBorrowPositionActions,
} from "../../src/features/borrow/market-position/model/details";
import { BorrowPositionActionPage } from "../../src/features/borrow/market-position/ui/action.page.tsx";
import { currentBorrowPositionsAtom } from "../../src/features/borrow/positions/state/positions";
import { walletScopeAtom } from "../../src/features/wallet/state";
import { createWidgetI18nInstance } from "../../src/services/translation/widget-translation";
import { WalletScopeKey } from "../../src/services/wallet/wallet-scope";
import { RootElementProvider } from "../../src/shared/react/root-element";
import { render } from "../utils/test-utils.dom.tsx";
import { applicationRuntimeInitInitialValue } from "../utils/widget-config";

const i18nInstance = createWidgetI18nInstance();

const marketDto = {
  availableLiquidity: "500000",
  availableLiquidityRaw: "500000000000",
  borrowRate: "0.06",
  collateralTokens: [
    {
      liquidationPenalty: "0.05",
      liquidationThreshold: "0.85",
      maxLtv: "0.8",
      priceUsd: "2000",
      supplyRate: "0.02",
      token: {
        address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
        decimals: 18,
        name: "Wrapped Ether",
        symbol: "WETH",
      },
    },
  ],
  feeWrapperAddress: null,
  id: "aave-v3-ethereum-usdc",
  integrationId: "aave-borrow",
  isBorrowEnabled: true,
  loanToken: {
    address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    decimals: 6,
    name: "USD Coin",
    symbol: "USDC",
  },
  loanTokenPriceUsd: "1",
  minLoan: null,
  network: "ethereum",
  poolAddress: "0x0000000000000000000000000000000000000001",
  supplyCollateralFeeBps: "0",
  totalBorrow: "500000",
  totalBorrowRaw: "500000000000",
  totalSupply: "1000000",
  totalSupplyRaw: "1000000000000",
  type: "pool",
  utilizationRate: "0.5",
} as const;

const integration = Schema.decodeUnknownSync(Integration)({
  actions: [],
  id: marketDto.integrationId,
  metadata: {
    description: "Aave lending and borrowing",
    externalLink: "https://aave.com",
    logoURI: "https://assets.stakek.it/protocols/aave.svg",
  },
  name: "Aave V3",
  networks: ["ethereum"],
  providerId: "aave",
});
const market = Schema.decodeUnknownSync(Market)(marketDto);
const address = (suffix: string) =>
  Schema.decodeSync(WalletAddress)(`0x${suffix.padStart(40, "0")}`);
const t = ((key: string) => key) as TFunction;

const makePosition = ({
  owner,
  supplied,
}: {
  readonly owner: WalletAddress;
  readonly supplied: string;
}) => {
  const [position] = deriveBorrowPositions({
    integrationAccountSnapshots: [
      {
        integration,
        accountSnapshot: Schema.decodeUnknownSync(BorrowAccountSnapshot)({
          address: owner,
          availableToBorrowUsd: "450",
          currentLtv: "0.4",
          debtBalances: [
            {
              apy: "0.06",
              balance: "400",
              balanceRaw: "400000000",
              balanceUsd: "400",
              marketId: market.id,
              pendingActions: [
                {
                  args: {
                    marketId: market.id,
                    tokenAddress: market.loanToken.address,
                  },
                  label: "Repay",
                  type: "repay",
                },
              ],
              tokenAddress: market.loanToken.address,
              tokenSymbol: market.loanToken.symbol,
            },
          ],
          healthFactor: "2.125",
          integrationId: integration.id,
          netApy: "-0.006",
          netWorthUsd: "600",
          network: market.network,
          supplyBalances: [
            {
              apy: "0.02",
              balance: supplied,
              balanceRaw: "500000000000000000",
              balanceUsd: (Number(supplied) * 2000).toString(),
              isCollateral: true,
              marketId: market.id,
              pendingActions: [
                {
                  args: {
                    amountRaw: "500000000000000000",
                    marketId: market.id,
                    tokenAddress: market.collateralTokens[0]!.token.address,
                  },
                  label: "Withdraw",
                  type: "withdraw",
                },
              ],
              tokenAddress: market.collateralTokens[0]!.token.address,
              tokenSymbol: market.collateralTokens[0]!.token.symbol,
            },
          ],
          totalBorrowedUsd: "400",
          totalCollateralUsd: "1000",
          totalSuppliedUsd: "1000",
        }),
      },
    ],
    markets: [market],
  }).items;

  if (!position) throw new Error("Expected Borrow position");
  return position;
};

const getAction = (
  position: ReturnType<typeof makePosition>,
  type: BorrowPositionAction["type"]
) => {
  const action = getBorrowPositionActions({ position, t }).find(
    (candidate) => candidate.type === type
  );
  if (!action) throw new Error(`Expected ${type} action`);
  return action;
};

const PositionOutlet = ({
  action,
  position,
}: {
  readonly action: BorrowPositionAction;
  readonly position: ReturnType<typeof makePosition>;
}) => (
  <Outlet
    context={{
      actions: [action],
      borrowPosition: null,
      model: null,
      position,
    }}
  />
);

const renderAction = ({
  action,
  owner,
  position,
}: {
  readonly action: BorrowPositionAction;
  readonly owner: WalletAddress;
  readonly position: ReturnType<typeof makePosition>;
}) => {
  const scope = new WalletScopeKey({ address: owner, network: "ethereum" });

  return (
    <RegistryProvider
      initialValues={[
        applicationRuntimeInitInitialValue(),
        [walletScopeAtom, scope],
        [currentBorrowPositionsAtom, AsyncResult.success([position])],
      ]}
      key={owner}
    >
      <RootElementProvider>
        <I18nextProvider i18n={i18nInstance}>
          <MemoryRouter
            initialEntries={[
              `/positions/borrow/${market.id}/action/${action.id}`,
            ]}
          >
            <Routes>
              <Route
                element={<PositionOutlet action={action} position={position} />}
                path="positions/borrow/:marketId"
              >
                <Route
                  element={<BorrowPositionActionPage />}
                  path="action/:actionId"
                />
              </Route>
            </Routes>
          </MemoryRouter>
        </I18nextProvider>
      </RootElementProvider>
    </RegistryProvider>
  );
};

const enterAmount = async (container: HTMLElement, value: string) => {
  const input = container.querySelector<HTMLInputElement>(
    '[data-testid="number-input"]'
  );
  if (!input) throw new Error("Expected amount input");
  const setValue = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value"
  )?.set;
  if (!setValue) throw new Error("Expected native input setter");

  await act(async () => {
    setValue.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
};

describe("Borrow position action wallet ownership", () => {
  it("resets a mounted withdraw form when its wallet owner changes", async () => {
    const ownerA = address("1");
    const ownerB = address("2");
    const positionA = makePosition({ owner: ownerA, supplied: "0.5" });
    const positionB = makePosition({ owner: ownerB, supplied: "0.2" });
    const actionA = getAction(positionA, "withdraw");
    const actionB = getAction(positionB, "withdraw");
    const app = await render(
      renderAction({ action: actionA, owner: ownerA, position: positionA })
    );

    await enterAmount(app.container, "0.1");
    expect(
      app.container.querySelector<HTMLInputElement>(
        '[data-testid="number-input"]'
      )?.value
    ).toBe("0.1");
    expect(app.container.textContent).toContain("0.5 WETH withdrawable");

    await app.rerender(
      renderAction({ action: actionB, owner: ownerB, position: positionB })
    );

    expect(
      app.container.querySelector<HTMLInputElement>(
        '[data-testid="number-input"]'
      )?.value
    ).toBe("0");
    expect(app.container.textContent).toContain("0.2 WETH withdrawable");
  });

  it("resets a mounted repay form when its wallet owner changes", async () => {
    const ownerA = address("1");
    const ownerB = address("2");
    const positionA = makePosition({ owner: ownerA, supplied: "0.5" });
    const positionB = makePosition({ owner: ownerB, supplied: "0.2" });
    const actionA = getAction(positionA, "repay");
    const actionB = getAction(positionB, "repay");
    const app = await render(
      renderAction({ action: actionA, owner: ownerA, position: positionA })
    );

    await enterAmount(app.container, "25");
    expect(
      app.container.querySelector<HTMLInputElement>(
        '[data-testid="number-input"]'
      )?.value
    ).toBe("25");

    await app.rerender(
      renderAction({ action: actionB, owner: ownerB, position: positionB })
    );

    expect(
      app.container.querySelector<HTMLInputElement>(
        '[data-testid="number-input"]'
      )?.value
    ).toBe("0");
  });
});
