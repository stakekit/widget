import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Effect, Layer, Schema } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { HttpResponse, http } from "msw";
import type { PropsWithChildren } from "react";
import { walletRuntime } from "../../src/app/runtime/wallet-runtime";
import { ActionCommand } from "../../src/domain/action/models";
import { WalletScopeKey } from "../../src/domain/wallet/wallet-scope";
import {
  type ClassicTransactionFlowIntake,
  makeClassicFlowSession,
} from "../../src/features/classic-transaction-flow/model/classic-transaction-flow";
import {
  type ClassicFlowSessionModule,
  makeClassicFlowExecutionScope,
  makeClassicFlowReviewScope,
  makeClassicFlowSessionModule,
} from "../../src/features/classic-transaction-flow/state/atoms/classic-flow-session";
import { ClassicTransactionFlowService } from "../../src/features/classic-transaction-flow/state/orchestration/classic-transaction-flow-service";
import {
  walletScopeAtom,
  walletStateResultAtom,
} from "../../src/features/wallet/index";
import { TransactionWorkflowService } from "../../src/services/transaction-workflow/transaction-workflow-service";
import {
  yieldApiActionFixture,
  yieldApiTransactionFixture,
  yieldApiYieldFixture,
} from "../fixtures";
import { makeConnectedWalletState } from "../fixtures/wallet-state";
import { TestAtomRuntimeProvider } from "../utils/atom-runtime-provider";
import { makeTestTracking } from "../utils/services/tracking-service";
import { makeTestWallet } from "../utils/services/wallet-service";
import { makeTestNavigation } from "../utils/services/widget-navigation";
import { makeTestStakeKitApiLayer } from "../utils/stakekit-api-layer";
import { describe, expect, it } from "../utils/test-extend.dom.ts";
import { renderHook } from "../utils/test-utils.dom.tsx";
import { getTestWidgetConfig } from "../utils/widget-config";

const yieldApiUrl = "https://yield.example.com";
const command = Schema.decodeSync(ActionCommand)({
  address: "0xWallet",
  yieldId: "ethereum-eth-native-staking",
});
const stake = yieldApiYieldFixture({ id: command.yieldId });
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

const classicDependencies = Layer.mergeAll(
  testDependencies,
  makeTestStakeKitApiLayer({
    apiKey: "test-key",
    baseUrl: "https://api.example.com",
    borrowApiUrl: "https://borrow.example.com",
    yieldsApiUrl: yieldApiUrl,
  }),
  Layer.succeed(
    TransactionWorkflowService,
    TransactionWorkflowService.of({
      make: () =>
        Effect.die(
          "action-preview test: unexpected TransactionWorkflowService.make"
        ),
    })
  )
);
const classicWalletLayer = Layer.merge(
  classicDependencies,
  ClassicTransactionFlowService.layer.pipe(Layer.provide(classicDependencies))
);

const Wrapper = ({ children }: PropsWithChildren) => (
  <TestAtomRuntimeProvider
    initialValues={[
      [walletScopeAtom, walletScope],
      [walletRuntime.layer, classicWalletLayer as never],
    ]}
    settings={getTestWidgetConfig({
      apiKey: "test-key",
      baseUrl: "https://api.example.com",
      variant: "default",
      yieldsApiUrl: yieldApiUrl,
    })}
  >
    {children}
  </TestAtomRuntimeProvider>
);

const settings = getTestWidgetConfig({
  apiKey: "test-key",
  baseUrl: "https://api.example.com",
  variant: "default",
  yieldsApiUrl: yieldApiUrl,
});

// The route owns one Session module per mount; each module's Review and
// Execution scopes are created once and live as long as it does.
const reviewScopeAtomFamily = Atom.family((session: ClassicFlowSessionModule) =>
  makeClassicFlowReviewScope(session)
);
const executionScopeAtomFamily = Atom.family(
  (session: ClassicFlowSessionModule) => makeClassicFlowExecutionScope(session)
);

/** Mounts an Earn Flow Session for `intake`, as the Classic flow route does. */
const makeEarnSessionAtoms = (
  intake: Extract<ClassicTransactionFlowIntake, { readonly _tag: "Enter" }>
) => {
  const sessionAtom = makeClassicFlowSessionModule(
    makeClassicFlowSession({ intake, mount: { _tag: "Earn" } }, walletScope)
  );
  const reviewFacadeAtom = Atom.make(
    (get) => get(reviewScopeAtomFamily(get(sessionAtom))).facade
  );
  const reviewViewAtom = Atom.make((get) =>
    get(get(reviewFacadeAtom).reviewViewAtom)
  );

  return {
    attachedActionAtom: Atom.make((get) => {
      const execution = get(executionScopeAtomFamily(get(sessionAtom)));
      return AsyncResult.getOrElse(get(execution.availabilityAtom), () => null);
    }),
    confirmAtom: Atom.fnSync(
      (_input: undefined, get) => {
        get.set(get(reviewFacadeAtom).confirmAtom, undefined);
      },
      { initialValue: undefined }
    ),
    kycGateAtom: Atom.make((get) => get(reviewViewAtom).kyc),
    refreshKycAtom: Atom.fnSync(
      (_input: undefined, get) => {
        get.set(get(reviewFacadeAtom).refreshKycAtom, undefined);
      },
      { initialValue: undefined }
    ),
    reviewViewAtom,
  } as const;
};

const ConnectedWrapper = ({ children }: PropsWithChildren) => (
  <TestAtomRuntimeProvider
    initialValues={[
      [walletRuntime.layer, classicWalletLayer as never],
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
    settings={settings}
  >
    {children}
  </TestAtomRuntimeProvider>
);

describe("action preview", () => {
  it("exposes a strictly decoded action from the Effect API service", async ({
    worker,
  }) => {
    const transaction = yieldApiTransactionFixture({
      gasEstimate: JSON.stringify({
        amount: "0.01",
        token: {
          decimals: 18,
          name: "Ethereum",
          network: "ethereum",
          symbol: "ETH",
        },
      }),
      id: "transaction-1",
      network: "ethereum",
    });
    worker.use(
      http.post(`${yieldApiUrl}/v1/actions/enter`, () =>
        HttpResponse.json(
          yieldApiActionFixture({
            address: "0xWallet",
            id: "action-1",
            transactions: [transaction],
            yieldId: "ethereum-eth-native-staking",
          })
        )
      )
    );

    const session = makeEarnSessionAtoms({
      _tag: "Enter",
      gasFeeToken: stake.mechanics.gasFeeToken,
      providersDetails: [],
      request: command,
      selectedStake: stake,
      selectedToken: stake.token,
      selectedValidators: new Map(),
      walletScope,
    });
    const { result } = await renderHook(
      () => useAtomValue(session.reviewViewAtom),
      { wrapper: Wrapper }
    );

    const getAction = () => result.current?.action;
    await expect.poll(() => getAction()?.id).toBe("action-1");
    expect(getAction()?.transactions[0]?.gasEstimate).toBe(
      transaction.gasEstimate
    );
  });

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

    const session = makeEarnSessionAtoms({
      _tag: "Enter",
      gasFeeToken: kycRequiredStake.mechanics.gasFeeToken,
      providersDetails: [],
      request: command,
      selectedStake: kycRequiredStake,
      selectedToken: kycRequiredStake.token,
      selectedValidators: new Map(),
      walletScope,
    });
    const { act, result } = await renderHook(
      () => ({
        kyc: useAtomValue(session.kycGateAtom),
        review: useAtomValue(session.reviewViewAtom),
        refreshKyc: useAtomSet(session.refreshKycAtom),
        confirmFlow: useAtomSet(session.confirmAtom),
        attachedAction: useAtomValue(session.attachedActionAtom),
      }),
      { wrapper: ConnectedWrapper }
    );

    await act(async () => {
      await expect.poll(() => kycStatusCalls).toBeGreaterThan(0);
    });
    const initialKycStatusCalls = kycStatusCalls;
    expect(actionPreviewCalls).toBe(0);
    expect(result.current.kyc?.isBlocking).toBe(true);
    expect(result.current.review?.action).toBeNull();
    await act(async () => result.current.confirmFlow(undefined));
    expect(result.current.attachedAction).toBeNull();

    kycStatus = "approved";
    await act(async () => {
      result.current.refreshKyc(undefined);
      await expect
        .poll(() => kycStatusCalls)
        .toBeGreaterThan(initialKycStatusCalls);
      await expect.poll(() => actionPreviewCalls).toBe(1);
    });
    await expect.poll(() => result.current.review?.action).not.toBeNull();
    expect(result.current.kyc?.isBlocking).toBe(false);
  });
});
