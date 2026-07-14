import { Duration, Effect, Layer, Schema } from "effect";
import { AsyncResult, Atom, AtomRegistry } from "effect/unstable/reactivity";
import { base, mainnet } from "viem/chains";
import { describe, expect, it, vi } from "vitest";
import type { Connector } from "wagmi";
import { WalletAddress, YieldId } from "../../src/domain/schema/identifiers";
import type { ActionMeta } from "../../src/domain/types/wallets/generic-wallet";
import {
  getStepsCompletionResources,
  getStepsMachineAtoms,
  StepsMachineAtomKey,
} from "../../src/pages/steps/state/steps-machine-atoms";
import { StepsMachineKey } from "../../src/pages/steps/state/steps-machine-model";
import { StepsMachineService } from "../../src/pages/steps/state/steps-machine-runtime";
import { StakeKitApiService } from "../../src/providers/api/api-service";
import { widgetAtomRuntime } from "../../src/providers/effect-atom-runtime/widget-runtime";
import { actionHistoryTimestampAtom } from "../../src/providers/stake-history";
import { TrackingService } from "../../src/providers/tracking/service";
import {
  WalletCapabilityUnavailableError,
  WalletService,
} from "../../src/providers/wallet/runtime/service";
import type { NormalizedWalletState } from "../../src/providers/wallet/state/wallet";
import { yieldApiTransactionFixture } from "../fixtures";
import type { WalletOperations } from "../utils/wallet-operations";

const address = Schema.decodeSync(WalletAddress)(
  "0x0000000000000000000000000000000000000001"
);
const yieldId = Schema.decodeSync(YieldId)("yield-1");
const connectedState = {
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
const defaultSignTransaction = () =>
  Effect.succeed({ broadcasted: false as const, signedTx: "signed" });
const makeWalletService = (
  signTransaction: WalletOperations["signTransaction"]
) =>
  ({
    getState: () => connectedState,
    signMessage: () => Effect.succeed("signed"),
    signTransaction,
  }) as unknown as WalletOperations;
const defaultWalletService = makeWalletService(defaultSignTransaction);

const key = () =>
  new StepsMachineAtomKey({
    machineKey: new StepsMachineKey({
      actionMeta: {} as ActionMeta,
      confirmationPollAttempts: 1,
      confirmationPollInterval: Duration.zero,
      transactions: [
        yieldApiTransactionFixture({
          id: "tx-1",
          network: "ethereum",
          status: "CREATED",
          unsignedTransaction: "unsigned",
        }),
      ],
      yieldId,
    }),
  });

const makeRegistry = ({
  trackEvent = () => Effect.void,
  walletService = defaultWalletService,
}: {
  readonly trackEvent?: TrackingService["Service"]["trackEvent"];
  readonly walletService?: WalletOperations;
} = {}) => {
  const confirmedTransaction = yieldApiTransactionFixture({
    explorerUrl: "https://explorer.test/tx",
    id: "tx-1",
    network: "ethereum",
    status: "CONFIRMED",
    unsignedTransaction: "unsigned",
  });
  const submittedTransaction = {
    ...confirmedTransaction,
    status: "BROADCASTED" as const,
  };
  const tokenBalances = vi.fn(() => Effect.succeed([]));
  const yieldBalances = vi.fn(() => Effect.succeed({ errors: [], items: [] }));
  const apiLayer = Layer.succeed(StakeKitApiService, {
    legacy: {
      scanTokenBalances: tokenBalances,
    },
    yield: {
      getTransactionStatus: () => Effect.succeed(confirmedTransaction),
      getYieldPositions: yieldBalances,
      submitSignedTransaction: () => Effect.succeed(submittedTransaction),
      submitTransactionHash: () => Effect.succeed(submittedTransaction),
    },
  } as never);
  const trackingLayer = Layer.succeed(TrackingService, { trackEvent });
  const walletLayer = Layer.succeed(
    WalletService,
    walletService as WalletService["Service"]
  );
  const stepsLayer = StepsMachineService.layer.pipe(
    Layer.provide(Layer.mergeAll(apiLayer, trackingLayer, walletLayer))
  );

  return {
    registry: AtomRegistry.make({
      initialValues: [
        Atom.initialValue(
          widgetAtomRuntime.layer,
          Layer.mergeAll(apiLayer, trackingLayer, walletLayer, stepsLayer).pipe(
            Layer.fresh
          )
        ),
      ],
    }),
    tokenBalances,
    yieldBalances,
  };
};

describe("classic steps machine atoms", () => {
  it("uses value equality to share one machine atom family instance", () => {
    const first = getStepsMachineAtoms(key());
    const second = getStepsMachineAtoms(key());

    expect(first).toBe(second);
    expect(first.machineAtom).toBe(second.machineAtom);
    expect(first.stateAtom).toBe(second.stateAtom);
    expect(first.dispatchAtom).toBe(second.dispatchAtom);
  });

  it("resolves services immediately and owns tracking/completion reactivity", async () => {
    const signTransaction = vi.fn(defaultSignTransaction);
    const trackEvent = vi.fn(() => Effect.void);
    const { registry, tokenBalances, yieldBalances } = makeRegistry({
      trackEvent,
      walletService: makeWalletService(signTransaction),
    });
    const atoms = getStepsMachineAtoms(key());
    const unmountCompletion = registry.mount(atoms.completionAtom);
    const unmountState = registry.mount(atoms.stateAtom);
    const unmountEvents = registry.mount(atoms.eventsAtom);
    const completionResources = getStepsCompletionResources(connectedState);
    const unmountCompletionResources = completionResources.map((resource) =>
      registry.mount(resource)
    );

    try {
      await vi.waitFor(() => {
        expect(tokenBalances).toHaveBeenCalledOnce();
        expect(yieldBalances).toHaveBeenCalledOnce();
      });

      registry.set(atoms.dispatchAtom, { _tag: "Start" });

      for (let attempt = 0; attempt < 50; attempt += 1) {
        const state = registry.get(atoms.stateAtom);

        if (AsyncResult.isSuccess(state) && state.value._tag === "Completed") {
          break;
        }

        await Effect.runPromise(Effect.yieldNow);
      }

      const state = registry.get(atoms.stateAtom);
      const event = registry.get(atoms.eventsAtom);

      expect(AsyncResult.isSuccess(state)).toBe(true);
      if (AsyncResult.isSuccess(state)) {
        expect(state.value._tag).toBe("Completed");
      }
      expect(AsyncResult.isSuccess(event)).toBe(true);
      if (AsyncResult.isSuccess(event)) {
        expect(event.value._tag).toBe("StepsCompleted");
      }
      expect(signTransaction).toHaveBeenCalledTimes(1);
      expect(trackEvent).toHaveBeenCalledWith("txSigned", expect.any(Object));
      expect(trackEvent).toHaveBeenCalledWith(
        "txSubmitted",
        expect.any(Object)
      );
      expect(registry.get(actionHistoryTimestampAtom)).toEqual(
        expect.any(Number)
      );
      await vi.waitFor(() => {
        expect(tokenBalances.mock.calls.length).toBeGreaterThan(1);
        expect(yieldBalances.mock.calls.length).toBeGreaterThan(1);
      });
    } finally {
      for (const unmount of unmountCompletionResources) unmount();
      unmountEvents();
      unmountState();
      unmountCompletion();
    }
  });

  it("re-reads live wallet state when retrying after a chain change", async () => {
    let currentState: NormalizedWalletState = {
      ...connectedState,
      chain: base,
      network: "base",
    };
    const signTransaction = vi.fn((request) =>
      Effect.suspend(() =>
        currentState.status === "connected" &&
        currentState.network === request.network
          ? Effect.succeed({
              broadcasted: false as const,
              signedTx: "signed",
            })
          : Effect.fail(
              new WalletCapabilityUnavailableError({
                capability: "transaction",
                connectorId: currentState.connector?.id ?? null,
              })
            )
      )
    );
    const walletService = {
      ...defaultWalletService,
      getState: () => currentState,
      signTransaction,
    };
    const { registry } = makeRegistry({ walletService });
    const atoms = getStepsMachineAtoms(key());
    const unmountState = registry.mount(atoms.stateAtom);

    try {
      registry.set(atoms.dispatchAtom, { _tag: "Start" });
      await vi.waitFor(() => {
        const state = registry.get(atoms.stateAtom);
        expect(AsyncResult.isSuccess(state) && state.value._tag).toBe(
          "SignFailed"
        );
      });

      currentState = connectedState;
      registry.set(atoms.dispatchAtom, { _tag: "RetrySign" });

      await vi.waitFor(() => {
        const state = registry.get(atoms.stateAtom);
        expect(AsyncResult.isSuccess(state) && state.value._tag).toBe(
          "Completed"
        );
      });
      expect(signTransaction).toHaveBeenCalledTimes(2);
    } finally {
      unmountState();
    }
  });
});
