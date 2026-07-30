import { RegistryProvider, useAtomSet } from "@effect/atom-react";
import { Effect, Layer, Schema, Stream } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { act } from "react";
import {
  MemoryRouter,
  type NavigateFunction,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router";
import { vi } from "vitest";
import { appRuntime } from "../../src/app/runtime/app-runtime";
import { walletRuntime } from "../../src/app/runtime/wallet-runtime";
import { WalletAddress } from "../../src/domain/schema/identifiers";
import type { ClassicTransactionFlowIntake } from "../../src/features/classic-transaction-flow/model/classic-transaction-flow";
import { startClassicTransactionFlowAtom } from "../../src/features/classic-transaction-flow/state";
import { createClassicFlowRoutes } from "../../src/features/classic-transaction-flow/ui";
import { WalletScopeRoute } from "../../src/features/wallet/react/wallet-scope-route";
import { walletScopeAtom } from "../../src/features/wallet/state";
import { WidgetNavigation } from "../../src/services/navigation/widget-navigation";
import { WalletScopeKey } from "../../src/services/wallet/domain/scope";
import type { NormalizedWalletState } from "../../src/services/wallet/domain/state";
import { WalletService } from "../../src/services/wallet/wallet-service";
import { yieldApiActionFixture, yieldApiYieldFixture } from "../fixtures";
import { describe, expect, it } from "../utils/test-extend.dom";
import { render } from "../utils/test-utils.dom";

vi.mock(
  "../../src/features/classic-transaction-flow/ui/activity-details.page",
  () => ({
    ActivityDetailsPage: function ActivityDetailsPage() {
      return (
        <output data-testid="historical-activity">Historical details</output>
      );
    },
  })
);
vi.mock(
  "../../src/features/classic-transaction-flow/ui/complete/pages/activity-complete.page",
  () => ({
    ActivityCompletePage: function ActivityCompletePage() {
      return <output data-testid="live-completion">Live completion</output>;
    },
  })
);

const walletScope = new WalletScopeKey({
  address: Schema.decodeSync(WalletAddress)(
    "0x1234567890123456789012345678901234567890"
  ),
  network: "ethereum",
});
const connectedWalletState: NormalizedWalletState = {
  additionalAddresses: null,
  address: walletScope.address,
  chain: {} as never,
  connector: {} as never,
  connectorChains: [],
  isLedgerLive: false,
  isLedgerLiveAccountPlaceholder: false,
  ledgerAccounts: [],
  network: walletScope.network,
  status: "connected",
};
const walletLayer = Layer.succeed(WalletService, {
  states: Stream.succeed({
    connection: connectedWalletState,
    ledger: {
      accounts: [],
      currentAccountId: undefined,
      disabledChains: [],
    },
  }),
} as never);

const navigationBridge: { navigate: NavigateFunction | null } = {
  navigate: null,
};
const navigationLayer = Layer.succeed(
  WidgetNavigation,
  WidgetNavigation.of({
    back: () => Effect.void,
    push: (path) =>
      Effect.sync(() => {
        navigationBridge.navigate?.(path);
      }),
    replace: () => Effect.void,
  })
);

const makeActivityIntake = (
  status: "PROCESSING" | "SUCCESS"
): Extract<
  ClassicTransactionFlowIntake,
  { readonly _tag: "ActivityResume" }
> => {
  const selectedYield = yieldApiYieldFixture();

  return {
    _tag: "ActivityResume",
    action: yieldApiActionFixture({
      status,
      type: "STAKE",
      yieldId: selectedYield.id,
    }),
    providersDetails: [],
    selectedValidators: [],
    selectedYield,
    walletScope,
  };
};

const StartPage = ({
  directPath,
  status,
}: {
  readonly directPath?: string;
  readonly status: "PROCESSING" | "SUCCESS";
}) => {
  const start = useAtomSet(startClassicTransactionFlowAtom);
  const navigate = useNavigate();
  navigationBridge.navigate = navigate;

  return (
    <button
      type="button"
      onClick={() => {
        start({
          intake: makeActivityIntake(status),
          mount: {
            _tag: "ActivityResume",
            presentation: "Classic",
            target: "HistoricalDetails",
          },
        });
        if (directPath) navigate(directPath);
      }}
    >
      Open Activity
    </button>
  );
};

const CurrentPath = () => {
  const location = useLocation();
  return <output data-testid="current-path">{location.pathname}</output>;
};

const TestApp = ({
  directPath,
  status,
}: {
  readonly directPath?: string;
  readonly status: "PROCESSING" | "SUCCESS";
}) => (
  <RegistryProvider
    initialValues={[
      [appRuntime.layer, navigationLayer],
      [walletScopeAtom, walletScope],
      [walletRuntime.layer, walletLayer as never],
    ]}
  >
    <MemoryRouter>
      <CurrentPath />
      <Routes>
        <Route
          path="/"
          element={<StartPage directPath={directPath} status={status} />}
        />
        <Route
          element={
            <WalletScopeRoute
              fallbackPath="/"
              walletStateResult={AsyncResult.success(connectedWalletState)}
            />
          }
        >
          <Route path="activity">
            {createClassicFlowRoutes({
              journey: "ActivityResume",
              presentation: "Classic",
            })}
          </Route>
        </Route>
      </Routes>
    </MemoryRouter>
  </RegistryProvider>
);

describe("Classic historical Activity route", () => {
  it.each(["PROCESSING", "SUCCESS"] as const)(
    "renders %s historical details without an Execution Attempt",
    async (status) => {
      const app = await render(<TestApp status={status} />);
      const openActivity = app.container.querySelector("button");
      if (!openActivity) throw new Error("Expected Open Activity button");

      await act(async () => {
        openActivity.click();
      });

      await vi.waitFor(() =>
        expect(
          app.container.querySelector('[data-testid="current-path"]')
            ?.textContent
        ).toBe("/activity/stake-review/complete")
      );
      await vi.waitFor(() =>
        expect(
          app.container.querySelector('[data-testid="historical-activity"]')
            ?.textContent
        ).toBe("Historical details")
      );
    }
  );

  it("keeps live completion behind the Execution Attempt guard", async () => {
    const app = await render(
      <TestApp directPath="/activity/stake/complete" status="SUCCESS" />
    );
    const openActivity = app.container.querySelector("button");
    if (!openActivity) throw new Error("Expected Open Activity button");

    await act(async () => {
      openActivity.click();
    });

    expect(
      app.container.querySelector('[data-testid="historical-activity"]')
    ).toBeNull();
    expect(
      app.container.querySelector('[data-testid="live-completion"]')
    ).toBeNull();
  });
});
