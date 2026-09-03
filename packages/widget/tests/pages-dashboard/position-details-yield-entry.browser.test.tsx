import { RegistryProvider, useAtomSet, useAtomValue } from "@effect/atom-react";
import BigNumber from "bignumber.js";
import { Effect, Layer, Schema } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { useEffect } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router";
import { RouterProvider } from "react-router/dom";
import { mainnet } from "viem/chains";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import type { Connector } from "wagmi";
import { ApplicationRouteContentProvider } from "../../src/app/composition/application-route-content";
import { applicationRoutes } from "../../src/app/routes/application-routes";
import { applicationBaseRuntime } from "../../src/app/runtime/application-base-runtime";
import { applicationRouterAtom } from "../../src/app/runtime/application-router";
import { walletRuntime } from "../../src/app/runtime/wallet-runtime";
import { WalletAddress } from "../../src/domain/identity/identifiers";
import { WalletScopeKey } from "../../src/domain/wallet/wallet-scope";
import { isActiveClassicTransactionFlowPathAtom } from "../../src/features/classic-transaction-flow/index";
import { tokenBalancesScanAtom } from "../../src/features/portfolio/index";
import {
  positionDetailsStakeViewAtom,
  setPositionDetailsStakeAmountAtom,
  submitPositionDetailsStakeAtom,
} from "../../src/features/position-details/state/dashboard-stake-facade";
import { PositionDetailsStakeEntryKey } from "../../src/features/position-details/state/dashboard-stake-machine";
import {
  walletConnectionStateAtom,
  walletScopeAtom,
} from "../../src/features/wallet/index";
import {
  YieldOpportunityKey,
  yieldOpportunityAtom,
} from "../../src/resources/yield-opportunity/provider";
import {
  PositionBalancesKey,
  positionBalancesByTypeAtom,
} from "../../src/resources/yield-positions/yield-positions";
import { WidgetConfigService } from "../../src/services/config/widget-config";
import { ApplicationRouter } from "../../src/services/navigation/application-router";
import { makeWidgetNavigation } from "../../src/services/navigation/widget-navigation";
import type { NormalizedWalletState } from "../../src/services/wallet/wallet-state";
import { yieldApiYieldFixture } from "../fixtures";
import { makeConnectedWalletState } from "../fixtures/wallet-state";
import { makeClassicFlowTestKit } from "../utils/classic-flow-test-kit";
import { render } from "../utils/test-utils";

const address = Schema.decodeSync(WalletAddress)(
  "0x1234567890123456789012345678901234567890"
);
const walletScope = new WalletScopeKey({
  address,
  network: "ethereum",
});
const selectedYield = yieldApiYieldFixture();
const entryKey = new PositionDetailsStakeEntryKey({
  balanceId: "balance-1",
  integrationId: selectedYield.id,
  walletScope,
});
const connectedWalletState = {
  additionalAddresses: null,
  address,
  chain: mainnet,
  connector: { id: "test", uid: "test" } as Connector,
  connectorChains: [mainnet],
  isLedgerLive: false,
  isLedgerLiveAccountPlaceholder: false,
  ledgerAccounts: [],
  network: "ethereum",
  status: "connected",
} satisfies NormalizedWalletState;
const walletState = makeConnectedWalletState(walletScope);
const navigationChannel: {
  navigate: ReturnType<typeof useNavigate> | null;
} = { navigate: null };
const navigation = makeWidgetNavigation({
  back: () => Effect.sync(() => navigationChannel.navigate?.(-1)),
  push: (path, options) =>
    Effect.sync(() => navigationChannel.navigate?.(path, options)),
  replace: (path, options) =>
    Effect.sync(() =>
      navigationChannel.navigate?.(path, { ...options, replace: true })
    ),
});
const makeClassicFlowLayer = () =>
  Layer.unwrap(
    makeClassicFlowTestKit({
      initialWalletState: walletState,
      navigation: { execute: navigation.execute },
    }).pipe(Effect.map((kit) => kit.layer))
  );

const NavigationBridge = () => {
  const navigate = useNavigate();
  useEffect(() => {
    navigationChannel.navigate = navigate;
    return () => {
      navigationChannel.navigate = null;
    };
  }, [navigate]);
  return null;
};

const PositionEntry = () => {
  const view = useAtomValue(positionDetailsStakeViewAtom(entryKey));
  const setAmount = useAtomSet(setPositionDetailsStakeAmountAtom(entryKey));
  const submit = useAtomSet(submitPositionDetailsStakeAtom(entryKey));

  return (
    <>
      <button
        data-testid="position-stake-amount"
        onClick={() => setAmount(new BigNumber(1))}
        type="button"
      >
        Set amount
      </button>
      <button
        data-testid="position-stake-submit"
        disabled={view.cta._tag !== "Submit" || view.cta.disabled}
        onClick={() => submit(undefined)}
        type="button"
      >
        Stake more
      </button>
    </>
  );
};

const ReviewGuard = () => {
  const isActive = useAtomValue(
    isActiveClassicTransactionFlowPathAtom(
      `/positions/${selectedYield.id}/balance-1/stake/review`
    )
  );
  return isActive ? (
    <div>Position stake review</div>
  ) : (
    <Navigate to="/missing" />
  );
};

const Runtime = () => {
  return (
    <>
      <NavigationBridge />
      <Routes>
        <Route
          path={`/positions/${selectedYield.id}/balance-1`}
          element={<PositionEntry />}
        />
        <Route
          path={`/positions/${selectedYield.id}/balance-1/stake/review`}
          element={<ReviewGuard />}
        />
        <Route path="/missing" element={<div>Missing Flow Session</div>} />
      </Routes>
    </>
  );
};

const Router = () => {
  const router = useAtomValue(applicationRouterAtom);

  return (
    <ApplicationRouteContentProvider value={<Runtime />}>
      <RouterProvider router={router} />
    </ApplicationRouteContentProvider>
  );
};

const TestApp = () => {
  const positionKey = new PositionBalancesKey({
    balanceId: entryKey.balanceId,
    scope: walletScope,
    yieldId: entryKey.integrationId,
  });

  return (
    <RegistryProvider
      initialValues={[
        [
          applicationBaseRuntime.layer,
          Layer.merge(
            ApplicationRouter.layer(applicationRoutes, {
              initialEntries: [`/positions/${selectedYield.id}/balance-1`],
            }),
            WidgetConfigService.layer({
              apiKey: "test",
              dashboardVariant: true,
              variant: "default",
            })
          ).pipe(Layer.fresh),
        ],
        [walletRuntime.layer, makeClassicFlowLayer()],
        [walletConnectionStateAtom, connectedWalletState],
        [walletScopeAtom, walletScope],
        [
          yieldOpportunityAtom.local(
            new YieldOpportunityKey({ yieldId: selectedYield.id })
          ),
          AsyncResult.success(selectedYield),
        ],
        [
          tokenBalancesScanAtom,
          {
            enabled: true,
            result: AsyncResult.success([
              {
                amount: "10",
                availableYields: [selectedYield.id],
                token: selectedYield.token,
              },
            ]),
          },
        ],
        [
          positionBalancesByTypeAtom(positionKey),
          AsyncResult.success(new Map()),
        ],
      ]}
    >
      <Router />
    </RegistryProvider>
  );
};

describe("position-details Yield Entry", () => {
  it("runs the production position facade through Effect-owned Review navigation", async () => {
    const app = await render(<TestApp />);

    await userEvent.click(app.getByTestId("position-stake-amount"));
    await expect
      .element(app.getByTestId("position-stake-submit"))
      .toBeEnabled();
    await userEvent.click(app.getByTestId("position-stake-submit"));

    await expect
      .element(app.getByText("Position stake review"))
      .toBeInTheDocument();
    expect(app.container.textContent).not.toContain("Missing Flow Session");
  });
});
