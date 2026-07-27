import BigNumber from "bignumber.js";
import { Effect, Layer, Option, Schema } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it, vi } from "vitest";
import {
  normalizeWidgetConfig,
  widgetConfigAtom,
} from "../../src/app/config/settings";
import { appRuntime } from "../../src/app/runtime/app-runtime";
import { applicationRouterAtom } from "../../src/app/runtime/application-router-runtime";
import { WalletAddress } from "../../src/domain/schema/identifiers";
import {
  classicFlowSessionStore,
  makeClassicTransactionFlowDestination,
} from "../../src/features/classic-transaction-flow/state";
import {
  getYieldEntryCta,
  makeYieldEntry,
  type YieldEntryFacadeInput,
} from "../../src/features/yield-entry/state/yield-entry";
import { WidgetNavigation } from "../../src/services/navigation/widget-navigation";
import { TrackingService } from "../../src/services/tracking/tracking-service";
import { WalletScopeKey } from "../../src/services/wallet/domain/scope";
import { WalletModal } from "../../src/services/wallet/wallet-modal";
import { yieldApiYieldFixture } from "../fixtures";

const address = Schema.decodeSync(WalletAddress)(
  "0x1234567890123456789012345678901234567890"
);
const walletScope = new WalletScopeKey({
  address,
  network: "ethereum",
});

const makeFacadeInput = (
  override: Partial<YieldEntryFacadeInput> = {}
): YieldEntryFacadeInput => {
  const selectedYield = yieldApiYieldFixture();
  return {
    availableAmount: new BigNumber(10),
    canSubmit: true,
    connected: true,
    defaultToMinimum: false,
    destination: makeClassicTransactionFlowDestination({ routeBase: "" }),
    entry: {
      amount: new BigNumber(1),
      selectedProviderYieldId: null,
      token: selectedYield.token,
      tronResource: null,
      useMaxAmount: false,
      validators: new Map(),
      yield: selectedYield,
    },
    externalProviders: false,
    hasNoYields: false,
    isAppLoading: false,
    isFetching: false,
    isKycBlocking: false,
    isKycLoading: false,
    isLedgerAccountPlaceholder: false,
    isOwnerCurrent: true,
    isWalletConnecting: false,
    positionsData: new Map(),
    providers: [
      {
        logo: undefined,
        name: "Provider",
        rewardRate: 0.12,
        rewardRateFormatted: "12%",
        rewardType: "apy",
      },
    ],
    submitted: false,
    validateAmount: true,
    wallet: {
      additionalAddresses: null,
      address,
      isLedgerLive: false,
    },
    walletScope,
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
      Layer.succeed(
        WidgetNavigation,
        WidgetNavigation.of({ back: () => Effect.void, push, replace })
      ),
      Layer.succeed(
        TrackingService,
        TrackingService.of({ trackEvent, trackPageView: () => Effect.void })
      )
    ) as never,
    openConnect,
    push,
    replace,
    trackEvent,
  } as const;
};

const makeObservableRegistry = (
  ports: ReturnType<typeof makeObservablePorts>
) =>
  AtomRegistry.make({
    initialValues: [
      [
        widgetConfigAtom,
        normalizeWidgetConfig({ apiKey: "test", variant: "default" }),
      ],
      [appRuntime.layer, ports.layer],
    ],
  });

const readSubmitOutcome = (
  registry: AtomRegistry.AtomRegistry,
  submitAtom: ReturnType<typeof makeYieldEntry>["submitAtom"]
) =>
  expect.poll(() =>
    registry.get(submitAtom).pipe(AsyncResult.value, Option.getOrNull)
  );

describe("Yield Entry", () => {
  it("publishes a stable derived entry view from caller-owned input", () => {
    const inputAtom = Atom.make(makeFacadeInput());
    const facade = makeYieldEntry(inputAtom, {
      markSubmitted: () => undefined,
      refreshKyc: () => undefined,
      runAddLedgerAccount: () => Effect.void,
    });
    const registry = AtomRegistry.make();

    try {
      const view = registry.get(facade.viewAtom);
      expect(view.cta).toEqual({
        _tag: "Submit",
        disabled: false,
        loading: false,
      });
      expect(view.preparation?.command.arguments?.amount).toBe("1");
      expect(view.validation.hasErrors).toBe(false);
      expect(view.estimatedRewards?.rewardRateAverage.toNumber()).toBe(0.12);
    } finally {
      registry.dispose();
    }
  });

  it.each([
    {
      expected: { _tag: "Hidden" },
      name: "no yields",
      override: { hasNoYields: true },
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
      override: { appLoading: true, connected: false },
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
      name: "entry is invalid",
      override: { canSubmit: false },
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
        appLoading: false,
        canSubmit: true,
        connected: true,
        externalProviders: false,
        hasNoYields: false,
        isFetching: false,
        kycBlocking: false,
        kycLoading: false,
        ledgerAccountPlaceholder: false,
        preparationAvailable: true,
        ...override,
      })
    ).toEqual(expected);
  });

  it("starts and navigates only for an eligible submission", async () => {
    const registry = AtomRegistry.make({
      initialValues: [
        [
          widgetConfigAtom,
          normalizeWidgetConfig({ apiKey: "test", variant: "default" }),
        ],
      ],
    });
    const validInput = makeFacadeInput();
    const inputAtom = Atom.make(
      makeFacadeInput({
        entry: {
          ...validInput.entry,
          amount: new BigNumber(0),
        },
      })
    );
    const facade = makeYieldEntry(inputAtom, {
      markSubmitted: (context) => {
        const current = context(inputAtom);
        context.set(inputAtom, { ...current, submitted: true });
      },
      refreshKyc: () => undefined,
      runAddLedgerAccount: () => Effect.void,
    });

    try {
      const router = registry.get(applicationRouterAtom);
      registry.set(facade.submitAtom, undefined);
      await expect
        .poll(() =>
          registry
            .get(facade.submitAtom)
            .pipe(AsyncResult.value, Option.getOrNull)
        )
        .toBe("invalid");
      expect(
        registry.get(classicFlowSessionStore.currentSessionAtom)
      ).toBeNull();

      registry.set(inputAtom, { ...validInput, isKycBlocking: true });
      registry.set(facade.submitAtom, undefined);
      await expect
        .poll(() =>
          registry
            .get(facade.submitAtom)
            .pipe(AsyncResult.value, Option.getOrNull)
        )
        .toBe("kyc-blocked");
      expect(
        registry.get(classicFlowSessionStore.currentSessionAtom)
      ).toBeNull();

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
        registry.get(classicFlowSessionStore.currentSessionAtom)?.intake._tag
      ).toBe("Enter");
      await expect.poll(() => router.state.location.pathname).toBe("/review");
    } finally {
      registry.dispose();
    }
  });

  it("starts one session and pushes Review through the navigation port", async () => {
    const ports = makeObservablePorts();
    const input = makeFacadeInput();
    const facade = makeYieldEntry(Atom.make(input), {
      markSubmitted: () => undefined,
      refreshKyc: () => undefined,
      runAddLedgerAccount: () => Effect.void,
    });
    const registry = makeObservableRegistry(ports);

    try {
      registry.set(facade.submitAtom, undefined);
      await readSubmitOutcome(registry, facade.submitAtom).toBe("submitted");
      expect(ports.push).toHaveBeenCalledWith(
        input.destination.reviewPath,
        expect.objectContaining({ _tag: "Push" })
      );
      expect(ports.replace).not.toHaveBeenCalled();
      expect(ports.openConnect).not.toHaveBeenCalled();
      expect(
        registry.get(classicFlowSessionStore.currentSessionAtom)?.intake._tag
      ).toBe("Enter");
    } finally {
      registry.dispose();
    }
  });

  it("does not publish a session when Review navigation fails", async () => {
    const navigationFailure = {
      _tag: "WidgetNavigationError",
      cause: new Error("navigation failed"),
    } as never;
    const registry = AtomRegistry.make({
      initialValues: [
        [
          widgetConfigAtom,
          normalizeWidgetConfig({ apiKey: "test", variant: "default" }),
        ],
        [
          appRuntime.layer,
          Layer.succeed(
            WidgetNavigation,
            WidgetNavigation.of({
              back: () => Effect.void,
              push: () => Effect.fail(navigationFailure),
              replace: () => Effect.void,
            })
          ) as never,
        ],
      ],
    });
    const facade = makeYieldEntry(Atom.make(makeFacadeInput()), {
      markSubmitted: () => undefined,
      refreshKyc: () => undefined,
      runAddLedgerAccount: () => Effect.void,
    });

    try {
      registry.set(facade.submitAtom, undefined);
      await expect
        .poll(() => AsyncResult.isFailure(registry.get(facade.submitAtom)))
        .toBe(true);
      await expect
        .poll(() => registry.get(classicFlowSessionStore.currentSessionAtom))
        .toBeNull();
    } finally {
      registry.dispose();
    }
  });

  it("opens the wallet modal and tracks the intent without starting a session", async () => {
    const ports = makeObservablePorts();
    const inputAtom = Atom.make(
      makeFacadeInput({
        connected: false,
        wallet: {
          additionalAddresses: null,
          address: null,
          isLedgerLive: false,
        },
        walletScope: null,
      })
    );
    const facade = makeYieldEntry(inputAtom, {
      markSubmitted: () => undefined,
      onConnectWallet: () =>
        TrackingService.use((tracking) =>
          tracking.trackEvent("connectWalletClicked")
        ),
      refreshKyc: () => undefined,
      runAddLedgerAccount: () => Effect.void,
    });
    const registry = makeObservableRegistry(ports);

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
        registry.get(classicFlowSessionStore.currentSessionAtom)
      ).toBeNull();
    } finally {
      registry.dispose();
    }
  });

  it("routes Ledger placeholders to account setup only", async () => {
    const ports = makeObservablePorts();
    const addLedgerAccount = vi.fn(() =>
      TrackingService.use((tracking) =>
        tracking.trackEvent("addLedgerAccountClicked")
      )
    );
    const inputAtom = Atom.make(
      makeFacadeInput({ isLedgerAccountPlaceholder: true })
    );
    const facade = makeYieldEntry(inputAtom, {
      markSubmitted: () => undefined,
      refreshKyc: () => undefined,
      runAddLedgerAccount: addLedgerAccount,
    });
    const registry = makeObservableRegistry(ports);

    try {
      registry.set(facade.submitAtom, undefined);
      await readSubmitOutcome(registry, facade.submitAtom).toBe(
        "ledger-account"
      );
      expect(addLedgerAccount).toHaveBeenCalledOnce();
      expect(ports.trackEvent).toHaveBeenCalledWith("addLedgerAccountClicked");
      expect(ports.openConnect).not.toHaveBeenCalled();
      expect(ports.push).not.toHaveBeenCalled();
      expect(
        registry.get(classicFlowSessionStore.currentSessionAtom)
      ).toBeNull();
    } finally {
      registry.dispose();
    }
  });

  it.each([
    {
      expected: "stale-owner",
      name: "stale owner",
      override: { isOwnerCurrent: false },
    },
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
      expected: "kyc-blocked",
      name: "KYC-blocked entry",
      override: { isKycBlocking: true },
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
    {
      expected: "unavailable",
      name: "external-provider-owned connection",
      override: {
        connected: false,
        externalProviders: true,
        wallet: {
          additionalAddresses: null,
          address: null,
          isLedgerLive: false,
        },
        walletScope: null,
      },
    },
    {
      expected: "unavailable",
      name: "wallet connection already in progress",
      override: {
        connected: false,
        isWalletConnecting: true,
        wallet: {
          additionalAddresses: null,
          address: null,
          isLedgerLive: false,
        },
        walletScope: null,
      },
    },
  ] as const)(
    "rejects a $name before starting a session",
    async ({ expected, override }) => {
      const ports = makeObservablePorts();
      const inputAtom = Atom.make(makeFacadeInput(override));
      const connect = vi.fn(() => Effect.void);
      const addLedgerAccount = vi.fn(() => Effect.void);
      const facade = makeYieldEntry(inputAtom, {
        markSubmitted: () => undefined,
        onConnectWallet: connect,
        refreshKyc: () => undefined,
        runAddLedgerAccount: addLedgerAccount,
      });
      const registry = makeObservableRegistry(ports);

      try {
        registry.set(facade.submitAtom, undefined);
        await readSubmitOutcome(registry, facade.submitAtom).toBe(expected);
        expect(
          registry.get(classicFlowSessionStore.currentSessionAtom)
        ).toBeNull();
        expect(connect).not.toHaveBeenCalled();
        expect(addLedgerAccount).not.toHaveBeenCalled();
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
