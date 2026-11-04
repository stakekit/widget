import BigNumber from "bignumber.js";
import { Effect, Layer, Option, Schema } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { describe, expect, it, vi } from "vitest";
import { appRuntime } from "../../../src/app/runtime/app-runtime";
import { walletRuntime } from "../../../src/app/runtime/wallet-runtime";
import {
  WalletAddress,
  YieldId,
} from "../../../src/domain/identity/identifiers";
import { WalletScopeKey } from "../../../src/domain/wallet/wallet-scope";
import { walletScopeAtom } from "../../../src/features/wallet/index";
import {
  getYieldFlowRouteGroup,
  startYieldTransactionFlowAtom,
} from "../../../src/features/yield-transaction-flow/index";
import {
  type NavigatingYieldTransactionFlowStart,
  type YieldTransactionFlowIntake,
  yieldFlowRoutes,
} from "../../../src/features/yield-transaction-flow/model/yield-transaction-flow";
import { makeWidgetNavigation } from "../../../src/services/navigation/widget-navigation";
import {
  type WidgetNavigationTarget,
  widgetTargetPath,
  widgetTargetState,
} from "../../../src/services/navigation/widget-routes";
import {
  disconnectedLedgerConnectorState,
  disconnectedNormalizedWalletState,
} from "../../../src/services/wallet/wallet-state";
import { yieldApiYieldFixture } from "../../fixtures";
import { makeTestNavigation } from "../../utils/services/widget-navigation";
import { makeYieldFlowTestKit } from "../../utils/yield-flow-test-kit";

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

type Intake<Tag extends YieldTransactionFlowIntake["_tag"]> = Extract<
  YieldTransactionFlowIntake,
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
    selectedProviderOption: null,
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
    balanceType: "claimable",
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

const makeRegistry = (
  push: (to: WidgetNavigationTarget) => void,
  currentWalletScope: WalletScopeKey = walletScope
) => {
  const navigation = makeWidgetNavigation({
    back: () => Effect.void,
    push: (to) => Effect.sync(() => push(to)),
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
        Layer.unwrap(
          makeTestNavigation({ execute: navigation.execute }).pipe(
            Effect.map((testNavigation) => testNavigation.layer)
          )
        )
      ),
      Atom.initialValue(
        walletRuntime.layer,
        Layer.unwrap(
          makeYieldFlowTestKit({
            initialWalletState: walletState,
            navigation: { execute: navigation.execute },
          }).pipe(Effect.map((kit) => kit.layer))
        ) as never
      ),
      Atom.initialValue(walletScopeAtom, currentWalletScope),
    ],
  });
};

const readStartOutcome = (registry: AtomRegistry.AtomRegistry) =>
  registry
    .get(startYieldTransactionFlowAtom)
    .pipe(AsyncResult.value, Option.getOrNull);

const startCases: ReadonlyArray<
  Readonly<{
    readonly name: string;
    readonly makeCommand: () => NavigatingYieldTransactionFlowStart;
    readonly reviewPath: string;
    readonly stepsPath: string;
    readonly completePath: string;
    readonly finishPath: string;
  }>
> = [
  {
    completePath: "/complete",
    finishPath: "/",
    makeCommand: () => ({ intake: makeEnterIntake(), mount: { _tag: "Earn" } }),
    name: "root Enter",
    reviewPath: "/review",
    stepsPath: "/steps",
  },
  {
    completePath: "/positions/yield/default/stake/complete",
    finishPath: "/positions",
    makeCommand: () => ({
      intake: makeEnterIntake(),
      mount: {
        _tag: "PositionStake",
        balanceId: "default",
        integrationId: Schema.decodeSync(YieldId)("yield"),
      },
    }),
    name: "position Stake",
    reviewPath: "/positions/yield/default/stake/review",
    stepsPath: "/positions/yield/default/stake/steps",
  },
  {
    completePath: "/positions/yield/default/unstake/complete",
    finishPath: "/positions",
    makeCommand: () => ({
      intake: makeExitIntake(),
      mount: {
        _tag: "PositionExit",
        balanceId: "default",
        integrationId: Schema.decodeSync(YieldId)("yield"),
      },
    }),
    name: "position Exit",
    reviewPath: "/positions/yield/default/unstake/review",
    stepsPath: "/positions/yield/default/unstake/steps",
  },
  {
    completePath: "/positions/yield/default/pending-action/complete",
    finishPath: "/positions",
    makeCommand: () => ({
      intake: makeManageIntake(),
      mount: {
        _tag: "PositionManage",
        balanceId: "default",
        integrationId: Schema.decodeSync(YieldId)("yield"),
      },
    }),
    name: "position Manage",
    reviewPath: "/positions/yield/default/pending-action/review",
    stepsPath: "/positions/yield/default/pending-action/steps",
  },
];

describe("Yield Transaction Flow interface", () => {
  it("rejects Start when the captured Wallet Scope Owner is stale", async () => {
    const push = vi.fn();
    const registry = makeRegistry(push, otherWalletScope);

    try {
      registry.set(startYieldTransactionFlowAtom, {
        intake: makeEnterIntake(),
        mount: { _tag: "Earn" },
      });

      await expect
        .poll(() => readStartOutcome(registry))
        .toEqual({ _tag: "RejectedOwner" });
      expect(push).not.toHaveBeenCalled();
    } finally {
      registry.dispose();
    }
  });

  it.each(startCases)(
    "starts $name by pushing its Review route with the new Session",
    async ({
      completePath,
      finishPath,
      makeCommand,
      reviewPath,
      stepsPath,
    }) => {
      const push = vi.fn<(to: WidgetNavigationTarget) => void>();
      const registry = makeRegistry(push);
      const command = makeCommand();

      try {
        registry.set(startYieldTransactionFlowAtom, command);

        await expect
          .poll(() => readStartOutcome(registry)?._tag)
          .toBe("Started");
        expect(push).toHaveBeenCalledOnce();
        const [to] = push.mock.calls[0] ?? [];
        if (to === undefined) throw new Error("Expected a Review navigation");
        expect(widgetTargetPath(to)).toBe(reviewPath);
        const session = Option.getOrThrow(
          yieldFlowRoutes.Earn.state(widgetTargetState(to)).pipe(
            Option.map((state) => state.yieldFlowSession)
          )
        );
        expect(session.intake).toEqual(command.intake);
        expect(session.mount).toEqual(command.mount);
        expect(session.destination).toMatchObject({
          completePath,
          finishPath,
          reviewPath,
          stepsPath,
        });
        const outcome = readStartOutcome(registry);
        expect(outcome?._tag === "Started" && outcome.session).toBe(session);
      } finally {
        registry.dispose();
      }
    }
  );
});

describe("Yield Flow route group", () => {
  it.each([
    ["/review", "/"],
    ["/steps", "/"],
    ["/complete", "/"],
    ["/complete/", "/"],
    ["/positions/yield/default/stake/review", "/positions/yield/default/stake"],
    ["/positions/yield/default/stake/steps", "/positions/yield/default/stake"],
    [
      "/positions/yield/default/stake/complete/",
      "/positions/yield/default/stake",
    ],
    [
      "/positions/yield/default/unstake/review",
      "/positions/yield/default/unstake",
    ],
    [
      "/positions/yield/default/unstake/complete",
      "/positions/yield/default/unstake",
    ],
    [
      "/positions/yield/default/pending-action/steps",
      "/positions/yield/default/pending-action",
    ],
    [
      "/positions/yield/validators/pending-action/steps",
      "/positions/yield/validators/pending-action",
    ],
    ["/activity/action-1", "/activity/action-1"],
    ["/activity/action-1/", "/activity/action-1"],
    ["/activity/action-1/steps", "/activity/action-1"],
    ["/activity/action-1/complete", "/activity/action-1"],
    ["/activity/action-2/steps", "/activity/action-2"],
  ] as const)("groups %s as %s", (pathname, group) => {
    expect(getYieldFlowRouteGroup(pathname)).toBe(group);
  });

  it.each([
    "/",
    "/positions",
    "/positions/yield/default",
    "/activity",
    "/activity/",
    "/borrow/review",
  ])("does not group %s", (pathname) => {
    expect(getYieldFlowRouteGroup(pathname)).toBeNull();
  });

  it("shares a group across one mount's flow routes and separates other mounts", () => {
    const groupsOf = (paths: ReadonlyArray<string>) =>
      new Set(paths.map(getYieldFlowRouteGroup));
    const mounts = [
      "",
      "/positions/yield/default/stake",
      "/positions/yield/default/unstake",
      "/positions/yield/default/pending-action",
      "/positions/yield/validators/stake",
      "/positions/yield/validators/pending-action",
    ];

    for (const base of mounts) {
      expect(
        groupsOf([`${base}/review`, `${base}/steps`, `${base}/complete`]).size
      ).toBe(1);
    }
    expect(groupsOf(mounts.map((base) => `${base}/review`)).size).toBe(
      mounts.length
    );
    expect(
      groupsOf(["/activity/action-1/steps", "/activity/action-2/steps"]).size
    ).toBe(2);
  });
});
