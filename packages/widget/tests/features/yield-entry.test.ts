import BigNumber from "bignumber.js";
import { Effect, Layer, Option, Schema, Stream } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it, vi } from "vitest";
import { appRuntime } from "../../src/app/runtime/app-runtime";
import { walletRuntime } from "../../src/app/runtime/wallet-runtime";
import { WalletAddress } from "../../src/domain/identity/identifiers";
import { WalletScopeKey } from "../../src/domain/wallet/wallet-scope";
import { isActiveClassicTransactionFlowPathAtom } from "../../src/features/classic-transaction-flow/index";
import { walletScopeAtom } from "../../src/features/wallet/index";
import { makeYieldEntry } from "../../src/features/yield-entry/index";
import { getYieldEntryCta } from "../../src/features/yield-entry/model/yield-entry";
import type { YieldEntryFacadeInput } from "../../src/features/yield-entry/state/atoms/yield-entry";
import { YieldEntrySubmissionService } from "../../src/features/yield-entry/state/orchestration/yield-entry-submission-service";
import {
  makeWidgetNavigation,
  WidgetNavigation,
} from "../../src/services/navigation/widget-navigation";
import { TrackingService } from "../../src/services/tracking/tracking-service";
import { WalletModal } from "../../src/services/wallet/wallet-modal";
import { WalletService } from "../../src/services/wallet/wallet-service";
import {
  disconnectedLedgerConnectorState,
  disconnectedNormalizedWalletState,
  type WalletState,
} from "../../src/services/wallet/wallet-state";
import { yieldApiYieldDtoFixture, yieldApiYieldFixture } from "../fixtures";
import { makeClassicFlowTestWalletLayer } from "../utils/classic-flow-wallet-layer";
import { applicationRuntimeInitInitialValue } from "../utils/widget-config";

const address = Schema.decodeSync(WalletAddress)(
  "0x1234567890123456789012345678901234567890"
);
const walletScope = new WalletScopeKey({
  address,
  network: "ethereum",
});
const walletState = {
  connection: {
    additionalAddresses: walletScope.additionalAddresses,
    address: walletScope.address,
    chain: {} as never,
    connector: {} as never,
    connectorChains: [],
    isLedgerLive: false,
    isLedgerLiveAccountPlaceholder: false,
    ledgerAccounts: [],
    network: walletScope.network,
    status: "connected",
  },
  ledger: disconnectedLedgerConnectorState,
} satisfies WalletState;
const makeWalletService = (state: WalletState) =>
  WalletService.of({
    addLedgerAccount: () => Effect.succeed({ _tag: "Added" } as const),
    state: Effect.succeed(state),
    states: Stream.succeed(state),
    wagmiConfig: {},
  } as never);

const walletService = makeWalletService(walletState);
const disconnectedWalletService = makeWalletService({
  connection: disconnectedNormalizedWalletState,
  ledger: disconnectedLedgerConnectorState,
});
const ledgerPlaceholderWalletService = makeWalletService({
  ...walletState,
  connection: {
    ...walletState.connection,
    connector: { id: "ledgerLive", uid: "ledger-a" } as never,
    isLedgerLive: true,
    isLedgerLiveAccountPlaceholder: true,
  },
});
const makeFacadeInput = (
  override: Partial<YieldEntryFacadeInput> = {}
): YieldEntryFacadeInput => {
  const selectedYield = yieldApiYieldFixture();
  return {
    amountInitialization: "PreserveIntent",
    availableAmount: new BigNumber(10),
    entry: {
      amount: new BigNumber(1),
      selectedProviderYieldId: null,
      token: selectedYield.token,
      tronResource: null,
      useMaxAmount: false,
      validators: new Map(),
      yield: selectedYield,
    },
    mount: { _tag: "Earn" },
    hasNoYields: false,
    readiness: { _tag: "Ready" },
    selectedYieldHasActivePosition: false,
    validationKey: "earn:default",
    ...override,
  };
};

/**
 * Observable stand-ins for every port a submission may reach, so a test can
 * assert both the effects a branch performs and the ones it must not.
 */
const makeObservablePorts = () => {
  const closeChain = vi.fn();
  const openConnect = vi.fn();
  const push = vi.fn(() => Effect.void);
  const replace = vi.fn(() => Effect.void);
  const trackEvent = vi.fn(() => Effect.void);
  const navigation = makeWidgetNavigation({
    back: () => Effect.void,
    push,
    replace,
  });

  return {
    closeChain,
    layer: Layer.mergeAll(
      Layer.succeed(
        WalletModal,
        WalletModal.of({
          closeChain: Effect.sync(closeChain),
          install: () => Effect.void,
          openConnect: Effect.sync(openConnect),
          uninstall: () => Effect.void,
        })
      ),
      Layer.succeed(WidgetNavigation, navigation),
      Layer.succeed(
        TrackingService,
        TrackingService.of({ trackEvent, trackPageView: () => Effect.void })
      )
    ) as never,
    openConnect,
    navigation,
    push,
    replace,
    trackEvent,
  } as const;
};

const makeObservableRegistry = (
  ports: ReturnType<typeof makeObservablePorts>,
  wallet: WalletService["Service"] = walletService,
  scope: WalletScopeKey | null = walletScope
) => {
  const flowLayer = makeClassicFlowTestWalletLayer({
    navigation: ports.navigation,
    wallet,
  });
  const yieldEntryDependencies = Layer.mergeAll(
    ports.layer,
    Layer.succeed(WalletService, wallet)
  );
  const runtimeLayer = Layer.merge(
    flowLayer,
    YieldEntrySubmissionService.layer.pipe(
      Layer.provide(yieldEntryDependencies)
    )
  );

  return AtomRegistry.make({
    initialValues: [
      applicationRuntimeInitInitialValue({
        apiKey: "test",
        variant: "default",
      }),
      [walletScopeAtom, scope],
      [appRuntime.layer, ports.layer],
      [walletRuntime.layer, runtimeLayer as never],
    ],
  });
};

const readSubmitOutcome = (
  registry: AtomRegistry.AtomRegistry,
  submitAtom: ReturnType<typeof makeYieldEntry>["submitAtom"]
) =>
  expect.poll(() =>
    registry.get(submitAtom).pipe(AsyncResult.value, Option.getOrNull)
  );

describe("Yield Entry", () => {
  it("owns validation attempts and resets them when the validation identity changes", async () => {
    const base = makeFacadeInput({
      entry: {
        ...makeFacadeInput().entry,
        amount: new BigNumber(0),
      },
    });
    const inputAtom = Atom.make({
      ...base,
      validationKey: "earn:first",
    });
    const facade = makeYieldEntry(inputAtom as never);
    const registry = makeObservableRegistry(makeObservablePorts());

    try {
      expect(registry.get(facade.viewAtom).validation.submitted).toBe(false);
      registry.set(facade.submitAtom, undefined);
      await readSubmitOutcome(registry, facade.submitAtom).toBe("invalid");
      expect(registry.get(facade.viewAtom).validation.submitted).toBe(true);

      registry.set(inputAtom, {
        ...base,
        validationKey: "earn:second",
      });
      expect(registry.get(facade.viewAtom).validation.submitted).toBe(false);
    } finally {
      registry.dispose();
    }
  });

  it("publishes a stable derived entry view from caller-owned input", () => {
    const input = makeFacadeInput();
    const inputAtom = Atom.make(input);
    const facade = makeYieldEntry(inputAtom);
    const registry = makeObservableRegistry(makeObservablePorts());

    try {
      const view = registry.get(facade.viewAtom);
      expect(view.cta).toEqual({
        _tag: "Submit",
        disabled: false,
        loading: false,
      });
      expect(view.preparation?.command.arguments?.amount).toBe("1");
      expect(view.validation.hasErrors).toBe(false);
      expect(view.estimatedRewards?.rewardRateAverage.toNumber()).toBe(
        input.entry.yield?.rewardRate.total
      );
    } finally {
      registry.dispose();
    }
  });

  it.each([
    {
      expectedAmount: "0",
      policy: "PreserveIntent",
    },
    {
      expectedAmount: "2",
      policy: "DefaultToMinimum",
    },
  ] as const)(
    "$policy controls whether a zero intent is projected to the minimum",
    ({ expectedAmount, policy }) => {
      const baseDto = yieldApiYieldDtoFixture();
      const selectedYield = yieldApiYieldFixture({
        mechanics: {
          ...baseDto.mechanics,
          arguments: {
            ...baseDto.mechanics.arguments,
            enter: {
              fields: [
                {
                  label: "Amount",
                  minimum: "2",
                  name: "amount",
                  type: "string",
                },
              ],
            },
          },
        },
      });
      const baseInput = makeFacadeInput();
      const facade = makeYieldEntry(
        Atom.make(
          makeFacadeInput({
            amountInitialization: policy,
            entry: {
              ...baseInput.entry,
              amount: new BigNumber(0),
              token: selectedYield.token,
              yield: selectedYield,
            },
          })
        )
      );
      const registry = makeObservableRegistry(makeObservablePorts());

      try {
        const view = registry.get(facade.viewAtom);
        expect(view.amount.toFixed()).toBe(expectedAmount);
        expect(view.preparation?.command.arguments?.amount).toBe(
          expectedAmount
        );
      } finally {
        registry.dispose();
      }
    }
  );

  it.each([
    {
      expected: { _tag: "Hidden" },
      name: "connected with no yields",
      override: { hasNoYields: true },
    },
    {
      expected: {
        _tag: "ConnectWallet",
        disabled: false,
        loading: false,
      },
      name: "disconnected with no yields",
      override: { connected: false, hasNoYields: true },
    },
    {
      expected: { _tag: "Hidden" },
      name: "external provider owns connection",
      override: { connected: false, externalProviders: true },
    },
    {
      expected: {
        _tag: "ConnectWallet",
        disabled: true,
        loading: true,
      },
      name: "wallet is connecting",
      override: { connected: false, readiness: { _tag: "Loading" as const } },
    },
    {
      expected: {
        _tag: "AddLedgerAccount",
        disabled: false,
        loading: false,
      },
      name: "Ledger account is a placeholder",
      override: { ledgerAccountPlaceholder: true },
    },
    {
      expected: { _tag: "Submit", disabled: true, loading: false },
      name: "entry is blocked",
      override: { readiness: { _tag: "Blocked" as const } },
    },
    {
      expected: { _tag: "Submit", disabled: true, loading: false },
      name: "KYC blocks submission",
      override: { kycBlocking: true },
    },
    {
      expected: { _tag: "Submit", disabled: false, loading: false },
      name: "connected entry is valid",
      override: {},
    },
  ])("resolves the $name CTA branch", ({ expected, override }) => {
    expect(
      getYieldEntryCta({
        connected: true,
        externalProviders: false,
        hasNoYields: false,
        kycBlocking: false,
        kycLoading: false,
        ledgerAccountPlaceholder: false,
        preparationAvailable: true,
        readiness: { _tag: "Ready" },
        ...override,
      })
    ).toEqual(expected);
  });

  it("starts and navigates only for an eligible submission", async () => {
    const ports = makeObservablePorts();
    const registry = makeObservableRegistry(ports);
    const validInput = makeFacadeInput();
    const inputAtom = Atom.make(
      makeFacadeInput({
        entry: {
          ...validInput.entry,
          amount: new BigNumber(0),
        },
      })
    );
    const facade = makeYieldEntry(inputAtom);

    try {
      registry.set(facade.submitAtom, undefined);
      await expect
        .poll(() =>
          registry
            .get(facade.submitAtom)
            .pipe(AsyncResult.value, Option.getOrNull)
        )
        .toBe("invalid");
      expect(
        registry.get(isActiveClassicTransactionFlowPathAtom("/review"))
      ).toBe(false);

      registry.set(inputAtom, {
        ...validInput,
        readiness: { _tag: "Blocked" },
      });
      registry.set(facade.submitAtom, undefined);
      await expect
        .poll(() =>
          registry
            .get(facade.submitAtom)
            .pipe(AsyncResult.value, Option.getOrNull)
        )
        .toBe("unavailable");
      expect(
        registry.get(isActiveClassicTransactionFlowPathAtom("/review"))
      ).toBe(false);

      registry.set(inputAtom, validInput);
      registry.set(facade.submitAtom, undefined);
      await expect
        .poll(() =>
          registry
            .get(facade.submitAtom)
            .pipe(AsyncResult.value, Option.getOrNull)
        )
        .toBe("submitted");
      expect(
        registry.get(isActiveClassicTransactionFlowPathAtom("/review"))
      ).toBe(true);
      expect(ports.push).toHaveBeenCalledWith(
        "/review",
        expect.objectContaining({ _tag: "Push" })
      );
    } finally {
      registry.dispose();
    }
  });

  it("starts one session and pushes Review through the navigation port", async () => {
    const ports = makeObservablePorts();
    const input = makeFacadeInput();
    const facade = makeYieldEntry(Atom.make(input));
    const registry = makeObservableRegistry(ports);

    try {
      registry.set(facade.submitAtom, undefined);
      await readSubmitOutcome(registry, facade.submitAtom).toBe("submitted");
      expect(ports.push).toHaveBeenCalledWith(
        "/review",
        expect.objectContaining({ _tag: "Push" })
      );
      expect(ports.replace).not.toHaveBeenCalled();
      expect(ports.openConnect).not.toHaveBeenCalled();
      expect(
        registry.get(isActiveClassicTransactionFlowPathAtom("/review"))
      ).toBe(true);
    } finally {
      registry.dispose();
    }
  });

  it("does not publish a session when Review navigation fails", async () => {
    const navigationFailure = {
      _tag: "WidgetNavigationError",
      cause: new Error("navigation failed"),
    } as never;
    const navigation = makeWidgetNavigation({
      back: () => Effect.void,
      push: () => Effect.fail(navigationFailure),
      replace: () => Effect.void,
    });
    const navigationLayer = Layer.succeed(WidgetNavigation, navigation);
    const registry = AtomRegistry.make({
      initialValues: [
        applicationRuntimeInitInitialValue({
          apiKey: "test",
          variant: "default",
        }),
        [walletScopeAtom, walletScope],
        [appRuntime.layer, navigationLayer as never],
        [
          walletRuntime.layer,
          makeClassicFlowTestWalletLayer({
            navigation,
            wallet: walletService,
          }) as never,
        ],
      ],
    });
    const facade = makeYieldEntry(Atom.make(makeFacadeInput()));

    try {
      registry.set(facade.submitAtom, undefined);
      await expect
        .poll(() => AsyncResult.isFailure(registry.get(facade.submitAtom)))
        .toBe(true);
      await expect
        .poll(() =>
          registry.get(isActiveClassicTransactionFlowPathAtom("/review"))
        )
        .toBe(false);
    } finally {
      registry.dispose();
    }
  });

  it("opens the wallet modal and tracks the intent without starting a session", async () => {
    const ports = makeObservablePorts();
    const inputAtom = Atom.make(makeFacadeInput());
    const facade = makeYieldEntry(inputAtom);
    const registry = makeObservableRegistry(
      ports,
      disconnectedWalletService,
      null
    );

    try {
      registry.set(facade.submitAtom, undefined);
      await readSubmitOutcome(registry, facade.submitAtom).toBe(
        "connecting-wallet"
      );
      expect(ports.openConnect).toHaveBeenCalledOnce();
      expect(ports.trackEvent).toHaveBeenCalledWith("connectWalletClicked");
      expect(ports.push).not.toHaveBeenCalled();
      expect(ports.replace).not.toHaveBeenCalled();
      expect(
        registry.get(isActiveClassicTransactionFlowPathAtom("/review"))
      ).toBe(false);
    } finally {
      registry.dispose();
    }
  });

  it("opens Connect Wallet for a connected entry whose scope is unavailable", async () => {
    const ports = makeObservablePorts();
    const facade = makeYieldEntry(Atom.make(makeFacadeInput()));
    const registry = makeObservableRegistry(ports, walletService, null);

    try {
      registry.set(facade.submitAtom, undefined);
      await readSubmitOutcome(registry, facade.submitAtom).toBe(
        "connecting-wallet"
      );
      expect(ports.openConnect).toHaveBeenCalledOnce();
    } finally {
      registry.dispose();
    }
  });

  it("routes Ledger placeholders to account setup only", async () => {
    const ports = makeObservablePorts();
    const inputAtom = Atom.make(makeFacadeInput());
    const facade = makeYieldEntry(inputAtom);
    const registry = makeObservableRegistry(
      ports,
      ledgerPlaceholderWalletService
    );

    try {
      registry.set(facade.submitAtom, undefined);
      await readSubmitOutcome(registry, facade.submitAtom).toBe(
        "ledger-account"
      );
      expect(ports.trackEvent).toHaveBeenCalledWith("addLedgerAccountClicked");
      expect(ports.closeChain).not.toHaveBeenCalled();
      expect(ports.openConnect).not.toHaveBeenCalled();
      expect(ports.push).not.toHaveBeenCalled();
      expect(
        registry.get(isActiveClassicTransactionFlowPathAtom("/review"))
      ).toBe(false);
    } finally {
      registry.dispose();
    }
  });

  it.each([
    {
      expected: "invalid",
      name: "entry failing validation",
      override: {
        entry: {
          ...makeFacadeInput().entry,
          amount: new BigNumber(0),
        },
      },
    },
    {
      expected: "unavailable",
      name: "blocked entry",
      override: { readiness: { _tag: "Blocked" } },
    },
    {
      expected: "unavailable",
      name: "missing preparation",
      override: {
        entry: {
          ...makeFacadeInput().entry,
          token: null,
        },
      },
    },
  ] as const)(
    "rejects a $name before starting a session",
    async ({ expected, override }) => {
      const ports = makeObservablePorts();
      const inputAtom = Atom.make(makeFacadeInput(override));
      const facade = makeYieldEntry(inputAtom);
      const registry = makeObservableRegistry(ports);

      try {
        registry.set(facade.submitAtom, undefined);
        await readSubmitOutcome(registry, facade.submitAtom).toBe(expected);
        expect(
          registry.get(isActiveClassicTransactionFlowPathAtom("/review"))
        ).toBe(false);
        expect(ports.openConnect).not.toHaveBeenCalled();
        expect(ports.closeChain).not.toHaveBeenCalled();
        expect(ports.trackEvent).not.toHaveBeenCalled();
        expect(ports.push).not.toHaveBeenCalled();
        expect(ports.replace).not.toHaveBeenCalled();
      } finally {
        registry.dispose();
      }
    }
  );
});
