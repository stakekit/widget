import BigNumber from "bignumber.js";
import { Effect, Layer, Option, Schema } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it, vi } from "vitest";
import { appRuntime } from "../../src/app/runtime/app-runtime";
import { WalletAddress } from "../../src/domain/schema/identifiers";
import type { ClassicTransactionFlowIntake } from "../../src/features/classic-transaction-flow/model/classic-transaction-flow";
import {
  isActiveClassicTransactionFlowPathAtom,
  startClassicTransactionFlowAtom,
} from "../../src/features/classic-transaction-flow/state";
import { walletScopeAtom } from "../../src/features/wallet/state";
import {
  WidgetNavigation,
  type WidgetNavigationOptions,
  type WidgetPath,
} from "../../src/services/navigation/widget-navigation";
import { WalletScopeKey } from "../../src/services/wallet/domain/scope";
import { yieldApiActionFixture, yieldApiYieldFixture } from "../fixtures";

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

const makeActivityResumeIntake = (
  status: "CREATED" | "SUCCESS"
): Intake<"ActivityResume"> => {
  const selectedYield = yieldApiYieldFixture();

  return {
    _tag: "ActivityResume",
    action: yieldApiActionFixture({
      status,
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
) =>
  AtomRegistry.make({
    initialValues: [
      Atom.initialValue(
        appRuntime.layer,
        Layer.succeed(
          WidgetNavigation,
          WidgetNavigation.of({
            back: () => Effect.void,
            push: (path, options) => Effect.sync(() => push(path, options)),
            replace: () => Effect.void,
          })
        )
      ),
      Atom.initialValue(walletScopeAtom, currentWalletScope),
    ],
  });

const readStartOutcome = (registry: AtomRegistry.AtomRegistry) =>
  registry
    .get(startClassicTransactionFlowAtom)
    .pipe(AsyncResult.value, Option.getOrNull);

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

      await expect
        .poll(() => readStartOutcome(registry))
        .toEqual({
          _tag: "Started",
        });
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

      await expect
        .poll(() => readStartOutcome(registry))
        .toEqual({ _tag: "Started" });
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

      await expect
        .poll(() => readStartOutcome(registry))
        .toEqual({ _tag: "Started" });
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

      await expect
        .poll(() => readStartOutcome(registry))
        .toEqual({ _tag: "Started" });
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

  it("starts Classic Activity Resume review at its canonical route mount", async () => {
    const push = vi.fn();
    const registry = makeRegistry(push);

    try {
      registry.set(startClassicTransactionFlowAtom, {
        intake: makeActivityResumeIntake("CREATED"),
        mount: {
          _tag: "ActivityResume",
          presentation: "Classic",
          target: "FreshReview",
        },
      });

      await expect
        .poll(() => readStartOutcome(registry))
        .toEqual({ _tag: "Started" });
      expect(push).toHaveBeenCalledWith("/activity/review", {
        _tag: "Push",
        path: "/activity/review",
      });
      expect(
        registry.get(
          isActiveClassicTransactionFlowPathAtom("/activity/stake/steps")
        )
      ).toBe(true);
    } finally {
      registry.dispose();
    }
  });

  it("starts Classic historical Activity details at its canonical route", async () => {
    const push = vi.fn();
    const registry = makeRegistry(push);

    try {
      registry.set(startClassicTransactionFlowAtom, {
        intake: makeActivityResumeIntake("SUCCESS"),
        mount: {
          _tag: "ActivityResume",
          presentation: "Classic",
          target: "HistoricalDetails",
        },
      });

      await expect
        .poll(() => readStartOutcome(registry))
        .toEqual({ _tag: "Started" });
      expect(push).toHaveBeenCalledWith(
        "/activity/stake-review/complete",
        expect.objectContaining({
          _tag: "Push",
          path: "/activity/stake-review/complete",
        })
      );
    } finally {
      registry.dispose();
    }
  });

  it("starts Dashboard Activity details without changing the current route", async () => {
    const push = vi.fn();
    const registry = makeRegistry(push);

    try {
      registry.set(startClassicTransactionFlowAtom, {
        intake: makeActivityResumeIntake("SUCCESS"),
        mount: {
          _tag: "ActivityResume",
          presentation: "Dashboard",
          target: "HistoricalDetails",
        },
      });

      await expect
        .poll(() => readStartOutcome(registry))
        .toEqual({ _tag: "Started" });
      expect(push).not.toHaveBeenCalled();
    } finally {
      registry.dispose();
    }
  });
});
