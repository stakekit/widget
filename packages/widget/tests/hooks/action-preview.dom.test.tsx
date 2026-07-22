import { RegistryProvider, useAtomSet, useAtomValue } from "@effect/atom-react";
import { Schema } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { HttpResponse, http } from "msw";
import { type PropsWithChildren, useEffect } from "react";
import {
  normalizeWidgetConfig,
  widgetConfigAtom,
} from "../../src/app/config/settings";
import { ActionCommand } from "../../src/domain/schema/action-models";
import type { ClassicTransactionFlowIntake } from "../../src/features/classic-transaction-flow/model/classic-transaction-flow";
import { useStartClassicTransactionFlow } from "../../src/features/classic-transaction-flow/react/use-transaction-flow";
import {
  type ClassicFlowSession,
  classicFlowSessionStore,
} from "../../src/features/classic-transaction-flow/session";
import {
  makeClassicFlowExecutionScope,
  makeClassicFlowReviewScope,
  makeClassicFlowSessionModule,
} from "../../src/features/classic-transaction-flow/state/classic-flow-session-facade";
import { currentWalletStateResultAtom } from "../../src/features/wallet/state/root-atom";
import { WalletScopeKey } from "../../src/services/wallet/domain/scope";
import {
  yieldApiActionFixture,
  yieldApiTransactionFixture,
  yieldApiYieldFixture,
} from "../fixtures";
import { TestAtomRuntimeProvider } from "../utils/atom-runtime-provider";
import { describe, expect, it } from "../utils/test-extend.dom";
import { renderHook } from "../utils/test-utils.dom";

const yieldApiUrl = "https://yield.example.com";
const command = Schema.decodeUnknownSync(ActionCommand)({
  address: "0xWallet",
  yieldId: "ethereum-eth-native-staking",
});
const stake = yieldApiYieldFixture({ id: command.yieldId });

const Wrapper = ({ children }: PropsWithChildren) => (
  <TestAtomRuntimeProvider
    settings={normalizeWidgetConfig({
      apiKey: "test-key",
      baseUrl: "https://api.example.com",
      variant: "default",
      yieldsApiUrl: yieldApiUrl,
    })}
  >
    {children}
  </TestAtomRuntimeProvider>
);

const settings = normalizeWidgetConfig({
  apiKey: "test-key",
  baseUrl: "https://api.example.com",
  variant: "default",
  yieldsApiUrl: yieldApiUrl,
});

const sessionRootAtomFamily = Atom.family((session: ClassicFlowSession) =>
  makeClassicFlowSessionModule(session)
);

const reviewScopeAtomFamily = Atom.family((session: ClassicFlowSession) =>
  (() => {
    const rootAtom = sessionRootAtomFamily(session);
    let reviewAtom: ReturnType<typeof makeClassicFlowReviewScope> | undefined;

    return Atom.make((get) => {
      const flow = get(rootAtom);
      reviewAtom ??= makeClassicFlowReviewScope(flow);
      return get(reviewAtom);
    });
  })()
);
const sessionReviewFacadeAtom = Atom.make((get) => {
  const session = get(classicFlowSessionStore.currentSessionAtom);
  return session ? get(reviewScopeAtomFamily(session)) : null;
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
  const session = get(classicFlowSessionStore.currentSessionAtom);
  if (!session) return null;

  const flow = get(sessionRootAtomFamily(session));
  const execution = get(makeClassicFlowExecutionScope(flow));
  return execution ? get(execution.actionAtom) : null;
});

const ConnectedWrapper = ({ children }: PropsWithChildren) => (
  <RegistryProvider
    initialValues={[
      [widgetConfigAtom, settings],
      [
        currentWalletStateResultAtom,
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
  </RegistryProvider>
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
        const startFlow = useStartClassicTransactionFlow();

        useEffect(() => {
          startFlow({
            _tag: "Enter",
            gasFeeToken: stake.mechanics.gasFeeToken,
            providersDetails: [],
            request: command,
            selectedStake: stake,
            selectedToken: stake.token,
            selectedValidators: new Map(),
            walletScope: new WalletScopeKey({
              address: command.address,
              network: "ethereum",
            }),
          } satisfies ClassicTransactionFlowIntake);
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
        const startFlow = useStartClassicTransactionFlow();

        useEffect(() => {
          startFlow({
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
      await expect.poll(() => kycStatusCalls).toBe(1);
    });
    expect(actionPreviewCalls).toBe(0);
    expect(result.current.kyc?.isGateBlocking).toBe(true);
    expect(result.current.review?.action).toBeNull();
    await act(async () => result.current.confirmFlow(undefined));
    expect(result.current.attachedAction).toBeNull();

    kycStatus = "approved";
    await act(async () => {
      result.current.refreshKyc(undefined);
      await expect.poll(() => kycStatusCalls).toBe(2);
      await expect.poll(() => actionPreviewCalls).toBe(1);
    });
    await expect.poll(() => result.current.review?.action).not.toBeNull();
    expect(result.current.kyc?.isGateBlocking).toBe(false);
  });
});
