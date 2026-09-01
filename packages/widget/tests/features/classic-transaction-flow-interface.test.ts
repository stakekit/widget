import BigNumber from "bignumber.js";
import { Effect, Layer, Option, Schema } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it, vi } from "vitest";
import { appRuntime } from "../../src/app/runtime/app-runtime";
import { walletRuntime } from "../../src/app/runtime/wallet-runtime";
import { WalletAddress } from "../../src/domain/identity/identifiers";
import { WalletScopeKey } from "../../src/domain/wallet/wallet-scope";
import {
  isActiveClassicTransactionFlowPathAtom,
  startClassicTransactionFlowAtom,
} from "../../src/features/classic-transaction-flow/index";
import type { ClassicTransactionFlowIntake } from "../../src/features/classic-transaction-flow/model/classic-transaction-flow";
import { walletScopeAtom } from "../../src/features/wallet/index";
import {
  makeWidgetNavigation,
  WidgetNavigation,
  type WidgetNavigationOptions,
  type WidgetPath,
} from "../../src/services/navigation/widget-navigation";
import {
  disconnectedLedgerConnectorState,
  disconnectedNormalizedWalletState,
} from "../../src/services/wallet/wallet-state";
import { yieldApiActionFixture, yieldApiYieldFixture } from "../fixtures";
import { makeClassicFlowTestLayer } from "../utils/classic-flow-layer";
import { makeTestWallet } from "../utils/services/wallet-service";
import { makeTestNavigation } from "../utils/services/widget-navigation";

const walletScope = new WalletScopeKey({
  address: Schema.decodeSync(WalletAddress)(
    "0x1234567890123456789012345678901234567890"
  ),
  network: "ethereum",
});
const otherWalletScope = new WalletScopeKey({
  address: Schema.decodeSync(WalletAddress)(
    "0x2234567890123456789012345678901234567890"
  ),
  network: "ethereum",
});

type Intake<Tag extends ClassicTransactionFlowIntake["_tag"]> = Extract<
  ClassicTransactionFlowIntake,
  { readonly _tag: Tag }
>;

const makeEnterIntake = (): Intake<"Enter"> => {
  const selectedStake = yieldApiYieldFixture();

  return {
    _tag: "Enter",
    gasFeeToken: selectedStake.mechanics.gasFeeToken,
    providersDetails: [{ name: "StakeKit" }],
    request: {
      address: walletScope.address,
      arguments: { amount: "1" },
      yieldId: selectedStake.id,
    },
    selectedStake,
    selectedToken: selectedStake.token,
    selectedValidators: new Map(),
    walletScope,
  };
};

const makeExitIntake = (): Intake<"Exit"> => {
  const integration = yieldApiYieldFixture();

  return {
    _tag: "Exit",
    gasFeeToken: integration.mechanics.gasFeeToken,
    integration,
    providersDetails: [],
    receiveToken: null,
    request: {
      address: walletScope.address,
      arguments: { amount: "1" },
      yieldId: integration.id,
    },
    unstakeAmount: new BigNumber(1),
    unstakeToken: integration.token,
    walletScope,
  };
};

const makeManageIntake = (): Intake<"Manage"> => {
  const integration = yieldApiYieldFixture();

  return {
    _tag: "Manage",
    gasFeeToken: integration.mechanics.gasFeeToken,
    integration,
    interactedToken: integration.token,
    pendingActionType: "CLAIM_REWARDS",
    providersDetails: [],
    request: {
      action: "CLAIM_REWARDS",
      address: walletScope.address,
      passthrough: "claim-rewards",
      yieldId: integration.id,
    },
    walletScope,
  };
};

const makeYieldActionContinuationIntake =
  (): Intake<"YieldActionContinuation"> => {
    const selectedYield = yieldApiYieldFixture();

    return {
      _tag: "YieldActionContinuation",
      action: yieldApiActionFixture({
        id: "action-1",
        status: "WAITING_FOR_NEXT",
        type: "STAKE",
        yieldId: selectedYield.id,
      }),
      providersDetails: [],
      selectedValidators: [],
      selectedYield,
      walletScope,
    };
  };

const makeRegistry = (
  push: (path: WidgetPath, options?: WidgetNavigationOptions) => void,
  currentWalletScope: WalletScopeKey = walletScope
) => {
  const navigation = makeWidgetNavigation({
    back: () => Effect.void,
    push: (path, options) => Effect.sync(() => push(path, options)),
    replace: () => Effect.void,
  });
  const walletState = {
    connection: currentWalletScope
      ? {
          ...disconnectedNormalizedWalletState,
          additionalAddresses: currentWalletScope.additionalAddresses,
          address: currentWalletScope.address,
          chain: {} as never,
          connector: {} as never,
          ledgerAccounts: [],
          network: currentWalletScope.network,
          status: "connected" as const,
        }
      : disconnectedNormalizedWalletState,
    ledger: disconnectedLedgerConnectorState,
  };

  return AtomRegistry.make({
    initialValues: [
      Atom.initialValue(
        appRuntime.layer,
        Layer.succeed(WidgetNavigation, navigation)
      ),
      Atom.initialValue(
        walletRuntime.layer,
        makeClassicFlowTestLayer({
          navigation: makeTestNavigation({ execute: navigation.execute }),
          wallet: makeTestWallet({ initialState: walletState }),
        }) as never
      ),
      Atom.initialValue(walletScopeAtom, currentWalletScope),
    ],
  });
};

const readStartOutcome = (registry: AtomRegistry.AtomRegistry) =>
  registry
    .get(startClassicTransactionFlowAtom)
    .pipe(AsyncResult.value, Option.getOrNull);

const waitForActivePath = (registry: AtomRegistry.AtomRegistry, path: string) =>
  expect
    .poll(() => registry.get(isActiveClassicTransactionFlowPathAtom(path)))
    .toBe(true);

describe("Classic Transaction Flow interface", () => {
  it("rejects Start when the captured Wallet Scope Owner is stale", async () => {
    const push = vi.fn();
    const registry = makeRegistry(push, otherWalletScope);

    try {
      registry.set(startClassicTransactionFlowAtom, {
        intake: makeEnterIntake(),
        mount: { _tag: "Earn" },
      });

      await expect
        .poll(() => readStartOutcome(registry))
        .toEqual({ _tag: "RejectedOwner" });
      expect(push).not.toHaveBeenCalled();
      expect(
        registry.get(isActiveClassicTransactionFlowPathAtom("/review"))
      ).toBe(false);
    } finally {
      registry.dispose();
    }
  });

  it("starts root Enter and publishes only its active route lifetime", async () => {
    const push = vi.fn();
    const registry = makeRegistry(push);

    try {
      registry.set(startClassicTransactionFlowAtom, {
        intake: makeEnterIntake(),
        mount: { _tag: "Earn" },
      });

      await waitForActivePath(registry, "/review");
      expect(push).toHaveBeenCalledWith("/review", {
        _tag: "Push",
        path: "/review",
      });
      expect(
        registry.get(isActiveClassicTransactionFlowPathAtom("/review"))
      ).toBe(true);
      expect(
        registry.get(isActiveClassicTransactionFlowPathAtom("/steps"))
      ).toBe(true);
      expect(
        registry.get(isActiveClassicTransactionFlowPathAtom("/complete"))
      ).toBe(true);
      expect(registry.get(isActiveClassicTransactionFlowPathAtom("/"))).toBe(
        false
      );
    } finally {
      registry.dispose();
    }
  });

  it("starts position Stake at its canonical route mount", async () => {
    const push = vi.fn();
    const registry = makeRegistry(push);

    try {
      registry.set(startClassicTransactionFlowAtom, {
        intake: makeEnterIntake(),
        mount: {
          _tag: "PositionStake",
          balanceId: "balance",
          integrationId: "yield",
        },
      });

      await waitForActivePath(
        registry,
        "/positions/yield/balance/stake/review"
      );
      expect(push).toHaveBeenCalledWith(
        "/positions/yield/balance/stake/review",
        {
          _tag: "Push",
          path: "/positions/yield/balance/stake/review",
        }
      );
      expect(
        registry.get(
          isActiveClassicTransactionFlowPathAtom(
            "/positions/yield/balance/stake/steps"
          )
        )
      ).toBe(true);
    } finally {
      registry.dispose();
    }
  });

  it("starts position Exit at its canonical route mount", async () => {
    const push = vi.fn();
    const registry = makeRegistry(push);

    try {
      registry.set(startClassicTransactionFlowAtom, {
        intake: makeExitIntake(),
        mount: {
          _tag: "PositionExit",
          balanceId: "balance",
          integrationId: "yield",
        },
      });

      await waitForActivePath(
        registry,
        "/positions/yield/balance/unstake/review"
      );
      expect(push).toHaveBeenCalledWith(
        "/positions/yield/balance/unstake/review",
        {
          _tag: "Push",
          path: "/positions/yield/balance/unstake/review",
        }
      );
    } finally {
      registry.dispose();
    }
  });

  it("starts position Manage at its canonical route mount", async () => {
    const push = vi.fn();
    const registry = makeRegistry(push);

    try {
      registry.set(startClassicTransactionFlowAtom, {
        intake: makeManageIntake(),
        mount: {
          _tag: "PositionManage",
          balanceId: "balance",
          integrationId: "yield",
        },
      });

      await waitForActivePath(
        registry,
        "/positions/yield/balance/pending-action/review"
      );
      expect(push).toHaveBeenCalledWith(
        "/positions/yield/balance/pending-action/review",
        {
          _tag: "Push",
          path: "/positions/yield/balance/pending-action/review",
        }
      );
    } finally {
      registry.dispose();
    }
  });

  it("starts Yield Action Continuation at the existing Activity details route", async () => {
    const push = vi.fn();
    const registry = makeRegistry(push);

    try {
      registry.set(startClassicTransactionFlowAtom, {
        intake: makeYieldActionContinuationIntake(),
        mount: {
          _tag: "YieldActionContinuation",
        },
      });

      await waitForActivePath(registry, "/activity/action-1");
      expect(push).not.toHaveBeenCalled();
      expect(
        registry.get(
          isActiveClassicTransactionFlowPathAtom("/activity/action-1/steps")
        )
      ).toBe(true);
    } finally {
      registry.dispose();
    }
  });

  it("does not own another action's Activity route", async () => {
    const push = vi.fn();
    const registry = makeRegistry(push);

    try {
      registry.set(startClassicTransactionFlowAtom, {
        intake: makeYieldActionContinuationIntake(),
        mount: {
          _tag: "YieldActionContinuation",
        },
      });

      await waitForActivePath(registry, "/activity/action-1/steps");
      expect(
        registry.get(
          isActiveClassicTransactionFlowPathAtom("/activity/action-2/steps")
        )
      ).toBe(false);
      expect(
        registry.get(
          isActiveClassicTransactionFlowPathAtom("/activity/action-2/complete")
        )
      ).toBe(false);
    } finally {
      registry.dispose();
    }
  });
});
