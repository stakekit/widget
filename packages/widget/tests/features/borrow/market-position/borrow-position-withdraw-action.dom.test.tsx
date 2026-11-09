import { RegistryProvider } from "@effect/atom-react";
import BigNumber from "bignumber.js";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Schema from "effect/Schema";
import type { TFunction } from "i18next";
import { act } from "react";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter, Outlet, Route, Routes } from "react-router";
import { describe, expect, it } from "vitest";

import { deriveBorrowPositions } from "../../../../src/domain/borrow/borrow-positions";
import { WalletAddress } from "../../../../src/domain/identity/identifiers";
import { WalletScopeKey } from "../../../../src/domain/wallet/wallet-scope";
import {
  type BorrowPositionAction,
  getBorrowPositionActions,
} from "../../../../src/features/borrow/market-position/model/details";
import { BorrowPositionActionPage } from "../../../../src/features/borrow/market-position/ui/action.page.tsx";
import { currentBorrowPositionsAtom } from "../../../../src/features/borrow/positions/state/positions";
import { walletScopeAtom } from "../../../../src/features/wallet/index";
import { createWidgetI18nInstance } from "../../../../src/services/translation/widget-translation";
import {
  makeBorrowAccountSnapshot,
  makeBorrowDebtBalanceDto,
  makeBorrowIntegration,
  makeBorrowMarket,
  makeBorrowSupplyBalanceDto,
} from "../../../fixtures/borrow";
import { render } from "../../../utils/test-utils.dom.tsx";
import { applicationRuntimeInitInitialValue } from "../../../utils/widget-config";

const i18nInstance = createWidgetI18nInstance();

const integration = makeBorrowIntegration();
const market = makeBorrowMarket();
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
        accountSnapshot: makeBorrowAccountSnapshot({
          address: owner,
          debtBalances: [
            makeBorrowDebtBalanceDto({
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
            }),
          ],
          supplyBalances: [
            makeBorrowSupplyBalanceDto({
              balance: supplied,
              balanceRaw: new BigNumber(supplied).shiftedBy(18).toFixed(0),
              balanceUsd: (Number(supplied) * 2000).toString(),
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
            }),
          ],
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
      onSelectAction: () => undefined,
      position,
      selection: { actionId: action.id, focusRequest: 0 },
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
    >
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
    </RegistryProvider>
  );
};

describe("Borrow position withdraw action", () => {
  it("sets Withdraw Max from the exact supplied balance", async () => {
    const owner = address("1");
    const supplied = "0.123456789012345678";
    const position = makePosition({ owner, supplied });
    const action = getAction(position, "withdraw");
    const app = await render(renderAction({ action, owner, position }));
    const maxButton = app.container.querySelector<HTMLButtonElement>(
      '[data-testid="stake-token-section-max-button"]'
    );
    if (!maxButton) throw new Error("Expected Max button");

    await act(async () => maxButton.click());

    expect(
      app.container.querySelector<HTMLInputElement>(
        '[data-testid="number-input"]'
      )?.value
    ).toBe(supplied);
  });
});
