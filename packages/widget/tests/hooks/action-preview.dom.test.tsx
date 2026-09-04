import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Effect, Layer, Schema } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { HttpResponse, http } from "msw";
import { type PropsWithChildren, useEffect } from "react";
import { walletRuntime } from "../../src/app/runtime/wallet-runtime";
import { ActionCommand } from "../../src/domain/action/models";
import { WalletScopeKey } from "../../src/domain/wallet/wallet-scope";
import { startClassicTransactionFlowAtom } from "../../src/features/classic-transaction-flow/index";
import type { ClassicTransactionFlowIntake } from "../../src/features/classic-transaction-flow/model/classic-transaction-flow";
import { currentClassicFlowSessionAtom } from "../../src/features/classic-transaction-flow/state/atoms/classic-flow";
import {
  classicFlowSessionRootAtomFamily,
  makeClassicFlowExecutionScope,
  makeClassicFlowReviewScope,
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

const reviewScopeAtomFamily = Atom.family(
  (rootAtom: ReturnType<typeof classicFlowSessionRootAtomFamily>) =>
    (() => {
      let reviewAtom: ReturnType<typeof makeClassicFlowReviewScope> | undefined;

      return Atom.make((get) => {
        const flow = get(rootAtom);
        reviewAtom ??= makeClassicFlowReviewScope(flow);
        return get(reviewAtom).facade;
      });
    })()
);
const sessionReviewFacadeAtom = Atom.make((get) => {
  const session = get(currentClassicFlowSessionAtom);
  return session
    ? get(reviewScopeAtomFamily(classicFlowSessionRootAtomFamily(session)))
    : null;
});
const sessionReviewViewAtom = Atom.make((get) => {
  const review = get(sessionReviewFacadeAtom);
  return review ? get(review.reviewViewAtom) : null;
});
const sessionKycGateAtom = Atom.make((get) => {
  return get(sessionReviewViewAtom)?.kyc ?? null;
});
const refreshSessionKycAtom = Atom.fnSync(
  (_input: undefined, get) => {
    const review = get(sessionReviewFacadeAtom);
    if (review) get.set(review.refreshKycAtom, undefined);
  },
  { initialValue: undefined }
);
const confirmSessionAtom = Atom.fnSync(
  (_input: undefined, get) => {
    const review = get(sessionReviewFacadeAtom);
    if (review) get.set(review.confirmAtom, undefined);
  },
  { initialValue: undefined }
);
const sessionAttachedActionAtom = Atom.make((get) => {
  const session = get(currentClassicFlowSessionAtom);
  if (!session) return null;

  const flow = get(classicFlowSessionRootAtomFamily(session));
  const execution = get(makeClassicFlowExecutionScope(flow));
  return AsyncResult.getOrElse(get(execution.availabilityAtom), () => null);
});

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

    const { result } = await renderHook(
      () => {
        const startFlow = useAtomSet(startClassicTransactionFlowAtom);

        useEffect(() => {
          startFlow({
            intake: {
              _tag: "Enter",
              gasFeeToken: stake.mechanics.gasFeeToken,
              providersDetails: [],
              request: command,
              selectedStake: stake,
              selectedToken: stake.token,
              selectedValidators: new Map(),
              walletScope,
            } satisfies ClassicTransactionFlowIntake,
            mount: { _tag: "Earn" },
          });
        }, [startFlow]);

        return useAtomValue(sessionReviewViewAtom);
      },
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

    const { act, result } = await renderHook(
      () => {
        const startFlow = useAtomSet(startClassicTransactionFlowAtom);

        useEffect(() => {
          startFlow({
            intake: {
              _tag: "Enter",
              gasFeeToken: kycRequiredStake.mechanics.gasFeeToken,
              providersDetails: [],
              request: command,
              selectedStake: kycRequiredStake,
              selectedToken: kycRequiredStake.token,
              selectedValidators: new Map(),
              walletScope: new WalletScopeKey({
                address: command.address,
                network: "ethereum",
              }),
            },
            mount: { _tag: "Earn" },
          });
        }, [startFlow]);

        return {
          kyc: useAtomValue(sessionKycGateAtom),
          review: useAtomValue(sessionReviewViewAtom),
          refreshKyc: useAtomSet(refreshSessionKycAtom),
          confirmFlow: useAtomSet(confirmSessionAtom),
          attachedAction: useAtomValue(sessionAttachedActionAtom),
        };
      },
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
