import { useAtom, useAtomSet, useAtomValue } from "@effect/atom-react";
import { Effect, Layer, Schema, Stream } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { HttpResponse, http } from "msw";
import type { PropsWithChildren } from "react";

import { ActionCommand } from "../../../src/domain/earn/action-models";
import { WalletScopeKey } from "../../../src/domain/wallet/wallet-scope";
import { walletStateResultAtom } from "../../../src/features/wallet/index";
import type { YieldTransactionFlowIntake } from "../../../src/features/yield-transaction-flow/model/intake";
import { makeYieldFlowSession } from "../../../src/features/yield-transaction-flow/model/session";
import { makeYieldFlowReviewPage } from "../../../src/features/yield-transaction-flow/state/review-page";
import type { SKAppProps } from "../../../src/public-api/react-types";
import { walletRuntime } from "../../../src/runtime/wallet-runtime";
import { TransactionWorkflowService } from "../../../src/services/transaction-workflow/transaction-workflow-service";
import { yieldApiActionFixture, yieldApiYieldFixture } from "../../fixtures";
import { makeConnectedWalletState } from "../../fixtures/wallet-state";
import { TestAtomRuntimeProvider } from "../../utils/atom-runtime-provider";
import { makeTestTracking } from "../../utils/services/tracking-service";
import { makeTestWallet } from "../../utils/services/wallet-service";
import { makeTestNavigation } from "../../utils/services/widget-navigation";
import { makeTestZamaLayer } from "../../utils/services/zama-service";
import { makeTestStakeKitApiLayer } from "../../utils/stakekit-api-layer";
import { describe, expect, it } from "../../utils/test-extend.dom.ts";
import { renderHook } from "../../utils/test-utils.dom.tsx";

const yieldApiUrl = "https://yield.example.com";
const command = Schema.decodeSync(ActionCommand)({
  address: "0xWallet",
  yieldId: "ethereum-eth-native-staking",
});
const walletScope = new WalletScopeKey({
  address: command.address,
  network: "ethereum",
});
const walletState = makeConnectedWalletState(walletScope);
const testDependencies = Layer.unwrap(
  Effect.all({
    navigation: makeTestNavigation(),
    tracking: makeTestTracking(),
    wallet: makeTestWallet({ initialState: walletState }),
  }).pipe(
    Effect.map(({ navigation, tracking, wallet }) =>
      Layer.mergeAll(navigation.layer, tracking.layer, wallet.layer)
    )
  )
);

const yieldDependencies = Layer.mergeAll(
  testDependencies,
  makeTestZamaLayer(),
  makeTestStakeKitApiLayer({
    apiKey: "test-key",
    baseUrl: "https://api.example.com",
    borrowApiUrl: "https://borrow.example.com",
    yieldsApiUrl: yieldApiUrl,
  }),
  Layer.succeed(
    TransactionWorkflowService,
    TransactionWorkflowService.of({
      leaveGuarded: Stream.make(false),
      make: () =>
        Effect.die(
          "action-preview test: unexpected TransactionWorkflowService.make"
        ),
    })
  )
);

const hostConfiguration: SKAppProps = {
  apiKey: "test-key",
  baseUrl: "https://api.example.com",
  variant: "default",
  yieldsApiUrl: yieldApiUrl,
};

/** Opens an Earn Flow Session and its Review page, as the flow routes do. */
const makeEarnReviewPage = (
  intake: Extract<YieldTransactionFlowIntake, { readonly _tag: "Enter" }>
) =>
  makeYieldFlowReviewPage(
    makeYieldFlowSession({ intake, mount: { _tag: "Earn" } }, walletScope)
  );

const ConnectedWrapper = ({ children }: PropsWithChildren) => (
  <TestAtomRuntimeProvider
    hostConfiguration={hostConfiguration}
    initialValues={[
      [walletRuntime.layer, yieldDependencies as never],
      [
        walletStateResultAtom,
        AsyncResult.success({
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
        }),
      ],
    ]}
  >
    {children}
  </TestAtomRuntimeProvider>
);

describe("action preview", () => {
  it("does not preview a KYC-blocked Enter flow", async ({ worker }) => {
    let actionPreviewCalls = 0;
    let kycStatusCalls = 0;
    let kycStatus = "not_started";
    const selectedStake = yieldApiYieldFixture();
    const kycRequiredStake = {
      ...selectedStake,
      mechanics: {
        ...selectedStake.mechanics,
        requirements: {
          ...selectedStake.mechanics.requirements,
          kycRequired: true,
        },
      },
    };

    worker.use(
      http.get(`${yieldApiUrl}/v1/yields/:yieldId/kyc/status`, () => {
        kycStatusCalls += 1;
        return HttpResponse.json({ kycStatus });
      }),
      http.post(`${yieldApiUrl}/v1/actions/enter`, () => {
        actionPreviewCalls += 1;
        return HttpResponse.json(yieldApiActionFixture());
      })
    );

    const review = makeEarnReviewPage({
      _tag: "Enter",
      gasFeeToken: kycRequiredStake.mechanics.gasFeeToken,
      providersDetails: [],
      request: command,
      selectedProviderOption: null,
      selectedStake: kycRequiredStake,
      selectedToken: kycRequiredStake.token,
      selectedValidators: new Map(),
      walletScope,
    });
    const { act, result } = await renderHook(
      () => {
        const [confirmation, confirm] = useAtom(review.confirmAtom);
        return {
          confirm,
          confirmation: AsyncResult.getOrElse(confirmation, () => undefined),
          refreshKyc: useAtomSet(review.refreshKycAtom),
          view: useAtomValue(review.reviewViewAtom),
        };
      },
      { wrapper: ConnectedWrapper }
    );

    await act(async () => {
      await expect.poll(() => kycStatusCalls).toBeGreaterThan(0);
    });
    const initialKycStatusCalls = kycStatusCalls;
    expect(actionPreviewCalls).toBe(0);
    expect(result.current.view.kyc.isBlocking).toBe(true);
    expect(result.current.view.action).toBeNull();
    await act(async () => result.current.confirm(undefined));
    await expect
      .poll(() => result.current.confirmation)
      .toEqual({ _tag: "RejectedBlocked" });
    expect(actionPreviewCalls).toBe(0);
    kycStatus = "approved";
    await act(async () => {
      result.current.refreshKyc(undefined);
      await expect
        .poll(() => kycStatusCalls)
        .toBeGreaterThan(initialKycStatusCalls);
      await expect.poll(() => actionPreviewCalls).toBe(1);
    });
    await expect.poll(() => result.current.view.action).not.toBeNull();
    expect(result.current.view.kyc.isBlocking).toBe(false);
    expect(actionPreviewCalls).toBe(1);
  });
});
