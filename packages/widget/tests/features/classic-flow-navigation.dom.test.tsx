import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Option, Schema } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { HttpResponse, http } from "msw";
import { act } from "react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router";
import { normalizeWidgetConfig } from "../../src/app/config/settings";
import { ActionCommand } from "../../src/domain/schema/action-models";
import type { ClassicTransactionFlowIntake } from "../../src/features/transaction-flow/model/classic-transaction-flow";
import {
  ClassicFlowReviewNavigation,
  ClassicFlowStepsNavigation,
} from "../../src/features/transaction-flow/react/classic-flow-navigation";
import { EnterClassicFlowRouteGuard } from "../../src/features/transaction-flow/react/request-route-guards";
import { classicTransactionFlowFacade } from "../../src/features/transaction-flow/state/classic-flow-facade";
import { WalletScopeRoute } from "../../src/features/wallet/react/wallet-scope-route";
import { WalletScopeKey } from "../../src/services/wallet/domain/scope";
import type { NormalizedWalletState } from "../../src/services/wallet/domain/state";
import { yieldApiActionFixture, yieldApiYieldFixture } from "../fixtures";
import { TestAtomRuntimeProvider } from "../utils/atom-runtime-provider";
import { describe, expect, it, vi } from "../utils/test-extend.dom";
import { render } from "../utils/test-utils.dom";

const yieldApiUrl = "https://yield.example.com";
const legacyApiUrl = "https://api.example.com";
const command = Schema.decodeUnknownSync(ActionCommand)({
  address: "0xWallet",
  yieldId: "ethereum-eth-native-staking",
});
const selectedStake = yieldApiYieldFixture({ id: command.yieldId });
const walletScope = new WalletScopeKey({
  address: command.address,
  network: "ethereum",
});
const walletState: NormalizedWalletState = {
  additionalAddresses: null,
  address: command.address,
  chain: {} as never,
  connector: {} as never,
  connectorChains: [],
  isLedgerLive: false,
  isLedgerLiveAccountPlaceholder: false,
  ledgerAccounts: [],
  network: "ethereum",
  status: "connected",
};

const intake: ClassicTransactionFlowIntake = {
  _tag: "Enter",
  gasFeeToken: selectedStake.mechanics.gasFeeToken,
  providersDetails: [],
  request: command,
  selectedStake,
  selectedToken: selectedStake.token,
  selectedValidators: new Map(),
  walletScope,
};

const StartPage = () => {
  const activeFlow = useAtomValue(classicTransactionFlowFacade.activeFlowAtom);
  const start = useAtomSet(classicTransactionFlowFacade.startAtom);
  const navigate = useNavigate();

  return (
    <>
      <button type="button" onClick={() => start(intake)}>
        Start
      </button>
      <button
        type="button"
        disabled={!activeFlow}
        onClick={() => navigate("/review")}
      >
        Review
      </button>
    </>
  );
};

const ReviewPage = () => {
  const activeFlow = useAtomValue(classicTransactionFlowFacade.activeFlowAtom);
  const actionPreview = useAtomValue(
    classicTransactionFlowFacade.actionPreviewAtom
  );
  const review = useAtomValue(classicTransactionFlowFacade.reviewViewAtom);
  const confirm = useAtomSet(classicTransactionFlowFacade.confirmAtom);
  const action = actionPreview.pipe(AsyncResult.value, Option.getOrNull);

  return (
    <>
      <output data-testid="review-identity">{activeFlow?.identity}</output>
      <output data-testid="review-prices">
        {review.prices ? "ready" : "loading"}
      </output>
      <button
        type="button"
        disabled={!activeFlow || !action}
        onClick={() => activeFlow && confirm(activeFlow.identity)}
      >
        Confirm
      </button>
      <ClassicFlowStepsNavigation to="/steps" />
    </>
  );
};

const StepsPage = () => {
  const activeFlow = useAtomValue(classicTransactionFlowFacade.activeFlowAtom);
  const returnToReview = useAtomSet(
    classicTransactionFlowFacade.returnToReviewAtom
  );

  return (
    <>
      <output data-testid="steps-identity">{activeFlow?.identity}</output>
      <button
        type="button"
        onClick={() => activeFlow && returnToReview(activeFlow.identity)}
      >
        Back
      </button>
      <ClassicFlowReviewNavigation to="/review" />
    </>
  );
};

describe("Classic Transaction Flow navigation", () => {
  it("commits a fresh Reviewing flow before routing Back from steps", async ({
    worker,
  }) => {
    let actionPreviewCalls = 0;
    let priceCalls = 0;
    worker.use(
      http.post(`${legacyApiUrl}/v1/tokens/prices`, () => {
        priceCalls += 1;
        return HttpResponse.json({
          "ethereum-": { price: 1, price_24_h: 0 },
        });
      }),
      http.post(`${yieldApiUrl}/v1/actions/enter`, () => {
        actionPreviewCalls += 1;
        return HttpResponse.json(
          yieldApiActionFixture({ id: `action-${actionPreviewCalls}` })
        );
      })
    );

    const app = await render(
      <TestAtomRuntimeProvider
        settings={normalizeWidgetConfig({
          apiKey: "test-key",
          baseUrl: legacyApiUrl,
          variant: "default",
          yieldsApiUrl: yieldApiUrl,
        })}
      >
        <MemoryRouter initialEntries={["/"]}>
          <Routes>
            <Route path="/" element={<StartPage />} />
            <Route
              element={
                <WalletScopeRoute
                  fallbackPath="/"
                  walletStateResult={AsyncResult.success(walletState)}
                />
              }
            >
              <Route element={<EnterClassicFlowRouteGuard />}>
                <Route path="review" element={<ReviewPage />} />
                <Route path="steps" element={<StepsPage />} />
              </Route>
            </Route>
          </Routes>
        </MemoryRouter>
      </TestAtomRuntimeProvider>
    );

    const buttons = () => [
      ...app.container.querySelectorAll<HTMLButtonElement>("button"),
    ];
    await act(async () => buttons()[0]?.click());
    await vi.waitFor(() => expect(buttons()[1]?.disabled).toBe(false));
    await act(async () => buttons()[1]?.click());
    await vi.waitFor(() => expect(buttons()[0]?.disabled).toBe(false));
    expect(actionPreviewCalls).toBe(1);
    await vi.waitFor(() => expect(priceCalls).toBe(1));

    const firstIdentity = app.container.querySelector(
      '[data-testid="review-identity"]'
    )?.textContent;
    await act(async () => buttons()[0]?.click());
    await vi.waitFor(() =>
      expect(
        app.container.querySelector('[data-testid="steps-identity"]')
      ).not.toBeNull()
    );

    await act(async () => buttons()[0]?.click());
    await vi.waitFor(() =>
      expect(
        app.container.querySelector('[data-testid="review-identity"]')
      ).not.toBeNull()
    );

    const secondIdentity = app.container.querySelector(
      '[data-testid="review-identity"]'
    )?.textContent;
    expect(secondIdentity).not.toBe(firstIdentity);
    expect(priceCalls).toBe(1);
    await vi.waitFor(() => expect(actionPreviewCalls).toBe(2));
    await vi.waitFor(() => expect(buttons()[0]?.disabled).toBe(false));

    await act(async () => buttons()[0]?.click());
    await vi.waitFor(() =>
      expect(
        app.container.querySelector('[data-testid="steps-identity"]')
          ?.textContent
      ).toBe(secondIdentity)
    );
  });
});
