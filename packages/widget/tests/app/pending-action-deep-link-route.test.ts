import { Effect, Layer, Schema } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it, vi } from "vitest";
import {
  canClaimPendingActionDeepLink,
  pendingActionDeepLinkRouteAtom,
} from "../../src/app/routes/state/pending-action-deep-link-route";
import { appRuntime } from "../../src/app/runtime/app-runtime";
import { ManageActionCommand } from "../../src/domain/schema/action-models";
import { EarnBalance } from "../../src/domain/schema/earn-models";
import { WalletAddress, YieldId } from "../../src/domain/schema/identifiers";
import { classicFlowSessionStore } from "../../src/features/classic-transaction-flow/state";
import {
  PendingActionDeepLinkIntentId,
  pendingActionDeepLinkViewAtom,
} from "../../src/features/earn/state/pending-action-deep-link";
import { mountAnimationStateAtom } from "../../src/features/mount-animation/state";
import { walletScopeAtom } from "../../src/features/wallet/state";
import {
  WidgetNavigation,
  type WidgetPath,
} from "../../src/services/navigation/widget-navigation";
import { WalletScopeKey } from "../../src/services/wallet/domain/scope";
import { yieldApiYieldFixture, yieldBalanceFixture } from "../fixtures";

const address = Schema.decodeSync(WalletAddress)(
  "0x0000000000000000000000000000000000000001"
);
const otherAddress = Schema.decodeSync(WalletAddress)(
  "0x0000000000000000000000000000000000000002"
);
const yieldId = Schema.decodeSync(YieldId)("test-yield");

const intent = (owner = address) =>
  new PendingActionDeepLinkIntentId({
    address: owner,
    network: "ethereum",
    pendingAction: "CLAIM_REWARDS",
    validator: null,
    yieldId,
  });

describe("pending-action deep-link route claims", () => {
  it("waits for route readiness, starts the Flow once, and navigates directly", async () => {
    const selectedYield = yieldApiYieldFixture({ id: yieldId });
    const balance = Schema.decodeUnknownSync(EarnBalance)(
      yieldBalanceFixture({ token: selectedYield.token })
    );
    const request = Schema.decodeUnknownSync(ManageActionCommand)({
      action: "CLAIM_REWARDS",
      address,
      passthrough: "pending-action",
      yieldId,
    });
    const push = vi.fn<(path: WidgetPath) => void>();
    const navigationLayer = Layer.succeed(
      WidgetNavigation,
      WidgetNavigation.of({
        back: () => Effect.void,
        push: (path) => Effect.sync(() => push(path)),
        replace: () => Effect.void,
      })
    );
    const projected = AsyncResult.success({
      balance,
      balanceId: "balance-1",
      intentId: intent(),
      pendingActionDto: {
        gasFeeToken: selectedYield.mechanics.gasFeeToken,
        integrationData: selectedYield,
        requestDto: request,
      },
      providersDetails: [],
      type: "review" as const,
      walletScope: new WalletScopeKey({
        address,
        network: "ethereum",
      }),
      yieldOp: selectedYield,
    }) as unknown as Atom.Type<typeof pendingActionDeepLinkViewAtom>;
    const registry = AtomRegistry.make({
      initialValues: [
        Atom.initialValue(appRuntime.layer, navigationLayer),
        Atom.initialValue(mountAnimationStateAtom, {
          earnPage: false,
          layout: false,
        }),
        Atom.initialValue(pendingActionDeepLinkViewAtom, projected),
        Atom.initialValue(
          walletScopeAtom,
          new WalletScopeKey({ address, network: "ethereum" })
        ),
      ],
    });
    const unmount = registry.mount(pendingActionDeepLinkRouteAtom);

    try {
      expect(push).not.toHaveBeenCalled();

      registry.set(mountAnimationStateAtom, { type: "all" });
      await vi.waitFor(() => expect(push).toHaveBeenCalledOnce());

      expect(push).toHaveBeenCalledWith(
        `/positions/${yieldId}/balance-1/pending-action/review`
      );
      expect(
        registry.get(classicFlowSessionStore.currentSessionAtom)
      ).toMatchObject({
        intake: {
          _tag: "Manage",
          request: { action: "CLAIM_REWARDS", yieldId },
        },
      });

      registry.set(mountAnimationStateAtom, { type: "all" });
      await Effect.runPromise(Effect.yieldNow);
      expect(push).toHaveBeenCalledOnce();
    } finally {
      unmount();
      registry.dispose();
    }
  });

  it("claims the rendered wallet-owner intent once", () => {
    const currentIntent = intent();

    expect(
      canClaimPendingActionDeepLink({
        claimedIntents: [],
        currentIntent,
        requestedIntent: intent(),
      })
    ).toBe(true);
    expect(
      canClaimPendingActionDeepLink({
        claimedIntents: [currentIntent],
        currentIntent,
        requestedIntent: intent(),
      })
    ).toBe(false);
  });

  it("rejects a stale rendered intent after the wallet owner changes", () => {
    expect(
      canClaimPendingActionDeepLink({
        claimedIntents: [],
        currentIntent: intent(otherAddress),
        requestedIntent: intent(),
      })
    ).toBe(false);
  });

  it("does not reclaim an earlier intent after another intent", () => {
    const first = intent();
    const second = intent(otherAddress);

    expect(
      canClaimPendingActionDeepLink({
        claimedIntents: [first, second],
        currentIntent: first,
        requestedIntent: first,
      })
    ).toBe(false);
  });
});
