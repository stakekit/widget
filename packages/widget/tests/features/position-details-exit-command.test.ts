import BigNumber from "bignumber.js";
import { Effect, Layer, Schema } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it, vi } from "vitest";
import { appRuntime } from "../../src/app/runtime/app-runtime";
import { EarnBalance } from "../../src/domain/schema/earn-models";
import { WalletAddress } from "../../src/domain/schema/identifiers";
import { classicFlowSessionStore } from "../../src/features/classic-transaction-flow/state";
import {
  PositionBalancesKey,
  positionBalancesAtom,
  positionBalancesByTypeAtom,
} from "../../src/features/portfolio/state";
import {
  runPositionPendingActionAtom,
  setPositionDetailsExitMaxAmountAtom,
  submitPositionDetailsExitAtom,
} from "../../src/features/position-details/state/classic-flow-actions";
import {
  PositionDetailsWorkflowKey,
  positionDetailsWorkflowAtom,
} from "../../src/features/position-details/state/workflow";
import { walletConnectionStateAtom } from "../../src/features/wallet/state";
import {
  YieldOpportunityKey,
  yieldOpportunityAtom,
} from "../../src/resources/yield-opportunity/provider";
import {
  WidgetNavigation,
  type WidgetPath,
} from "../../src/services/navigation/widget-navigation";
import { TrackingService } from "../../src/services/tracking/tracking-service";
import { WalletScopeKey } from "../../src/services/wallet/domain/scope";
import type { NormalizedWalletState } from "../../src/services/wallet/domain/state";
import { yieldApiYieldFixture, yieldBalanceFixture } from "../fixtures";

const address = Schema.decodeSync(WalletAddress)(
  "0x1234567890123456789012345678901234567890"
);
const otherAddress = Schema.decodeSync(WalletAddress)(
  "0x2234567890123456789012345678901234567890"
);
const sameAddressDifferentCase = Schema.decodeSync(WalletAddress)(
  address.toUpperCase()
);
const scope = new WalletScopeKey({ address, network: "ethereum" });
const baseYield = yieldApiYieldFixture();
const selectedYield = yieldApiYieldFixture({
  metadata: {
    ...baseYield.metadata,
    supportedStandards: ["ERC4626"],
  },
});
const balance = Schema.decodeUnknownSync(EarnBalance)(
  yieldBalanceFixture({
    address,
    amount: "1",
    token: selectedYield.token,
  })
);
const manageBalance = Schema.decodeUnknownSync(EarnBalance)(
  yieldBalanceFixture({
    address,
    amount: "1",
    pendingActions: [
      {
        amount: "1",
        arguments: { fields: [] },
        intent: "manage",
        passthrough: "wallet-a-action",
        type: "CLAIM_REWARDS",
      },
    ],
    token: selectedYield.token,
  })
);
const manageAction = manageBalance.pendingActions[0]!;
const workflowKey = new PositionDetailsWorkflowKey({
  balanceId: "balance-1",
  integrationId: selectedYield.id,
  pendingActionType: null,
  scope,
});
const positionKey = new PositionBalancesKey({
  balanceId: workflowKey.balanceId,
  scope,
  yieldId: selectedYield.id,
});

const makeConnectedWallet = (
  overrides: Partial<
    Extract<NormalizedWalletState, { readonly status: "connected" }>
  > = {}
): Extract<NormalizedWalletState, { readonly status: "connected" }> => ({
  additionalAddresses: null,
  address,
  chain: {} as never,
  connector: {} as never,
  connectorChains: [],
  isLedgerLive: false,
  isLedgerLiveAccountPlaceholder: false,
  ledgerAccounts: [],
  network: "ethereum",
  status: "connected",
  ...overrides,
});

const makeRegistry = ({
  push,
  trackEvent,
  wallet = makeConnectedWallet(),
}: {
  readonly push: ReturnType<typeof vi.fn<(path: WidgetPath) => void>>;
  readonly trackEvent: TrackingService["Service"]["trackEvent"];
  readonly wallet?: NormalizedWalletState;
}) =>
  AtomRegistry.make({
    initialValues: [
      Atom.initialValue(
        appRuntime.layer,
        Layer.mergeAll(
          Layer.succeed(
            WidgetNavigation,
            WidgetNavigation.of({
              back: () => Effect.void,
              push: (path) => Effect.sync(() => push(path)),
              replace: () => Effect.void,
            })
          ),
          Layer.succeed(
            TrackingService,
            TrackingService.of({
              trackEvent,
              trackPageView: () => Effect.void,
            })
          )
        ) as never
      ),
      Atom.initialValue(walletConnectionStateAtom, wallet),
      Atom.initialValue(
        yieldOpportunityAtom(
          new YieldOpportunityKey({ yieldId: selectedYield.id })
        ),
        AsyncResult.success(selectedYield)
      ),
      Atom.initialValue(
        positionBalancesAtom(positionKey),
        AsyncResult.success({
          balances: [balance],
          rewardRate: null,
          type: "default" as const,
        })
      ),
      Atom.initialValue(
        positionBalancesByTypeAtom(positionKey),
        AsyncResult.success(
          new Map([
            ["active", [{ ...balance, tokenPriceInUsd: new BigNumber(1) }]],
          ])
        )
      ),
    ],
  });

describe("Position Details exit command", () => {
  it("submits the displayed partial amount for an ERC-4626 exit", async () => {
    const push = vi.fn<(path: WidgetPath) => void>();
    const trackEvent = vi.fn<TrackingService["Service"]["trackEvent"]>(
      () => Effect.void
    );
    const registry = makeRegistry({ push, trackEvent });

    try {
      registry.set(positionDetailsWorkflowAtom(workflowKey), {
        pendingActions: new Map(),
        unstakeAmount: new BigNumber("0.4"),
        unstakeUseMaxAmount: false,
      });
      registry.set(submitPositionDetailsExitAtom(workflowKey), undefined);

      await vi.waitFor(() => expect(push).toHaveBeenCalledOnce());
      expect(push).toHaveBeenCalledWith(
        `/positions/${selectedYield.id}/balance-1/unstake/review`
      );
      expect(
        registry.get(classicFlowSessionStore.currentSessionAtom)?.intake
      ).toMatchObject({
        _tag: "Exit",
        request: {
          arguments: {
            amount: "0.4",
          },
        },
        unstakeAmount: new BigNumber("0.4"),
      });
    } finally {
      registry.dispose();
    }
  });

  it("sets the displayed maximum and tracks the user intent", async () => {
    const push = vi.fn<(path: WidgetPath) => void>();
    const trackEvent = vi.fn<TrackingService["Service"]["trackEvent"]>(
      () => Effect.void
    );
    const registry = makeRegistry({ push, trackEvent });

    try {
      registry.set(setPositionDetailsExitMaxAmountAtom(workflowKey), undefined);

      await vi.waitFor(() => expect(trackEvent).toHaveBeenCalledOnce());
      expect(registry.get(positionDetailsWorkflowAtom(workflowKey))).toEqual({
        pendingActions: new Map(),
        unstakeAmount: new BigNumber(1),
        unstakeUseMaxAmount: true,
      });
      expect(trackEvent).toHaveBeenCalledWith("positionDetailsPageMaxClicked", {
        yieldId: selectedYield.id,
      });
      expect(push).not.toHaveBeenCalled();
    } finally {
      registry.dispose();
    }
  });

  it("rejects a stale Exit command after the Wallet Scope Owner changes", async () => {
    const push = vi.fn<(path: WidgetPath) => void>();
    const trackEvent = vi.fn<TrackingService["Service"]["trackEvent"]>(
      () => Effect.void
    );
    const registry = makeRegistry({
      push,
      trackEvent,
      wallet: makeConnectedWallet({ address: otherAddress }),
    });

    try {
      registry.set(positionDetailsWorkflowAtom(workflowKey), {
        pendingActions: new Map(),
        unstakeAmount: new BigNumber("0.4"),
        unstakeUseMaxAmount: false,
      });
      registry.set(submitPositionDetailsExitAtom(workflowKey), undefined);

      await Promise.resolve();

      expect(push).not.toHaveBeenCalled();
      expect(
        registry.get(classicFlowSessionStore.currentSessionAtom)
      ).toBeNull();
    } finally {
      registry.dispose();
    }
  });

  it("rejects a stale Manage command after the Wallet Scope Owner changes", async () => {
    const push = vi.fn<(path: WidgetPath) => void>();
    const trackEvent = vi.fn<TrackingService["Service"]["trackEvent"]>(
      () => Effect.void
    );
    const registry = makeRegistry({
      push,
      trackEvent,
      wallet: makeConnectedWallet({ address: otherAddress }),
    });

    try {
      registry.set(runPositionPendingActionAtom(workflowKey), {
        _tag: "Select",
        pendingActionDto: manageAction,
        yieldBalance: manageBalance,
      });

      await Promise.resolve();

      expect(push).not.toHaveBeenCalled();
      expect(
        registry.get(classicFlowSessionStore.currentSessionAtom)
      ).toBeNull();
    } finally {
      registry.dispose();
    }
  });

  it("captures refreshed additional addresses in both the Exit request and Wallet Scope", async () => {
    const push = vi.fn<(path: WidgetPath) => void>();
    const trackEvent = vi.fn<TrackingService["Service"]["trackEvent"]>(
      () => Effect.void
    );
    const registry = makeRegistry({
      push,
      trackEvent,
      wallet: makeConnectedWallet({
        additionalAddresses: { cosmosPubKey: "cosmos-refreshed" },
        address: sameAddressDifferentCase,
      }),
    });

    try {
      registry.set(positionDetailsWorkflowAtom(workflowKey), {
        pendingActions: new Map(),
        unstakeAmount: new BigNumber("0.4"),
        unstakeUseMaxAmount: false,
      });
      registry.set(submitPositionDetailsExitAtom(workflowKey), undefined);

      await vi.waitFor(() => expect(push).toHaveBeenCalledOnce());
      const intake = registry.get(
        classicFlowSessionStore.currentSessionAtom
      )?.intake;

      expect(intake).toMatchObject({
        _tag: "Exit",
        request: {
          address: sameAddressDifferentCase,
          arguments: {
            cosmosPubKey: "cosmos-refreshed",
          },
        },
        walletScope: {
          additionalAddresses: {
            cosmosPubKey: "cosmos-refreshed",
          },
          address: sameAddressDifferentCase,
          network: "ethereum",
        },
      });
    } finally {
      registry.dispose();
    }
  });

  it("captures one refreshed Wallet Scope for a Manage request and intake", async () => {
    const push = vi.fn<(path: WidgetPath) => void>();
    const trackEvent = vi.fn<TrackingService["Service"]["trackEvent"]>(
      () => Effect.void
    );
    const registry = makeRegistry({
      push,
      trackEvent,
      wallet: makeConnectedWallet({
        additionalAddresses: { cosmosPubKey: "cosmos-refreshed" },
        address: sameAddressDifferentCase,
      }),
    });

    try {
      registry.set(runPositionPendingActionAtom(workflowKey), {
        _tag: "Select",
        pendingActionDto: manageAction,
        yieldBalance: manageBalance,
      });

      await vi.waitFor(() => expect(push).toHaveBeenCalledOnce());
      const intake = registry.get(
        classicFlowSessionStore.currentSessionAtom
      )?.intake;

      expect(intake).toMatchObject({
        _tag: "Manage",
        request: {
          address: sameAddressDifferentCase,
          arguments: {
            cosmosPubKey: "cosmos-refreshed",
          },
        },
        walletScope: {
          additionalAddresses: {
            cosmosPubKey: "cosmos-refreshed",
          },
          address: sameAddressDifferentCase,
          network: "ethereum",
        },
      });
    } finally {
      registry.dispose();
    }
  });
});
