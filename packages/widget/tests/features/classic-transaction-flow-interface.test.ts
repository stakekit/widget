import BigNumber from "bignumber.js";
import { Effect, Layer, Option, Schema } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { describe, expect, it, vi } from "vitest";
import { appRuntime } from "../../src/app/runtime/app-runtime";
import { walletRuntime } from "../../src/app/runtime/wallet-runtime";
import { WalletAddress } from "../../src/domain/identity/identifiers";
import { WalletScopeKey } from "../../src/domain/wallet/wallet-scope";
import {
  getClassicFlowRouteGroup,
  startClassicTransactionFlowAtom,
} from "../../src/features/classic-transaction-flow/index";
import {
  type ClassicTransactionFlowIntake,
  decodeClassicFlowNavigationState,
  type NavigatingClassicTransactionFlowStart,
} from "../../src/features/classic-transaction-flow/model/classic-transaction-flow";
import { walletScopeAtom } from "../../src/features/wallet/index";
import {
  makeWidgetNavigation,
  type WidgetNavigationOptions,
  type WidgetPath,
} from "../../src/services/navigation/widget-navigation";
import {
  disconnectedLedgerConnectorState,
  disconnectedNormalizedWalletState,
} from "../../src/services/wallet/wallet-state";
import { yieldApiYieldFixture } from "../fixtures";
import { makeClassicFlowTestKit } from "../utils/classic-flow-test-kit";
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
        Layer.unwrap(
          makeTestNavigation({ execute: navigation.execute }).pipe(
            Effect.map((testNavigation) => testNavigation.layer)
          )
        )
      ),
      Atom.initialValue(
        walletRuntime.layer,
        Layer.unwrap(
          makeClassicFlowTestKit({
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
    .get(startClassicTransactionFlowAtom)
    .pipe(AsyncResult.value, Option.getOrNull);

const startCases: ReadonlyArray<
  Readonly<{
    readonly name: string;
    readonly makeCommand: () => NavigatingClassicTransactionFlowStart;
    readonly reviewPath: string;
    readonly stepsPath: string;
    readonly completePath: string;
  }>
> = [
  {
    completePath: "/complete",
    makeCommand: () => ({ intake: makeEnterIntake(), mount: { _tag: "Earn" } }),
    name: "root Enter",
    reviewPath: "/review",
    stepsPath: "/steps",
  },
  {
    completePath: "/positions/yield/balance/stake/complete",
    makeCommand: () => ({
      intake: makeEnterIntake(),
      mount: {
        _tag: "PositionStake",
        balanceId: "balance",
        integrationId: "yield",
      },
    }),
    name: "position Stake",
    reviewPath: "/positions/yield/balance/stake/review",
    stepsPath: "/positions/yield/balance/stake/steps",
  },
  {
    completePath: "/positions/yield/balance/unstake/complete",
    makeCommand: () => ({
      intake: makeExitIntake(),
      mount: {
        _tag: "PositionExit",
        balanceId: "balance",
        integrationId: "yield",
      },
    }),
    name: "position Exit",
    reviewPath: "/positions/yield/balance/unstake/review",
    stepsPath: "/positions/yield/balance/unstake/steps",
  },
  {
    completePath: "/positions/yield/balance/pending-action/complete",
    makeCommand: () => ({
      intake: makeManageIntake(),
      mount: {
        _tag: "PositionManage",
        balanceId: "balance",
        integrationId: "yield",
      },
    }),
    name: "position Manage",
    reviewPath: "/positions/yield/balance/pending-action/review",
    stepsPath: "/positions/yield/balance/pending-action/steps",
  },
];

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
    } finally {
      registry.dispose();
    }
  });

  it.each(startCases)(
    "starts $name by pushing its Review route with the new Session",
    async ({ completePath, makeCommand, reviewPath, stepsPath }) => {
      const push =
        vi.fn<(path: WidgetPath, options?: WidgetNavigationOptions) => void>();
      const registry = makeRegistry(push);
      const command = makeCommand();

      try {
        registry.set(startClassicTransactionFlowAtom, command);

        await expect
          .poll(() => readStartOutcome(registry)?._tag)
          .toBe("Started");
        expect(push).toHaveBeenCalledOnce();
        const [path, options] = push.mock.calls[0] ?? [];
        expect(path).toBe(reviewPath);
        const session = Option.getOrThrow(
          decodeClassicFlowNavigationState(options?.state)
        );
        expect(session.intake).toEqual(command.intake);
        expect(session.mount).toEqual(command.mount);
        expect(session.destination).toEqual({
          completePath,
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

describe("Classic Flow route group", () => {
  it.each([
    ["/review", "/"],
    ["/steps", "/"],
    ["/complete", "/"],
    ["/complete/", "/"],
    ["/positions/yield/balance/stake/review", "/positions/yield/balance/stake"],
    ["/positions/yield/balance/stake/steps", "/positions/yield/balance/stake"],
    [
      "/positions/yield/balance/stake/complete/",
      "/positions/yield/balance/stake",
    ],
    [
      "/positions/yield/balance/unstake/review",
      "/positions/yield/balance/unstake",
    ],
    [
      "/positions/yield/balance/unstake/complete",
      "/positions/yield/balance/unstake",
    ],
    [
      "/positions/yield/balance/pending-action/steps",
      "/positions/yield/balance/pending-action",
    ],
    [
      "/positions/yield/other/pending-action/steps",
      "/positions/yield/other/pending-action",
    ],
    ["/activity/action-1", "/activity/action-1"],
    ["/activity/action-1/", "/activity/action-1"],
    ["/activity/action-1/steps", "/activity/action-1"],
    ["/activity/action-1/complete", "/activity/action-1"],
    ["/activity/action-2/steps", "/activity/action-2"],
    ["/", null],
    ["/positions", null],
    ["/positions/yield/balance", null],
    ["/activity", null],
    ["/activity/", null],
    ["/borrow/review", null],
  ] as const)("groups %s as %s", (pathname, group) => {
    expect(getClassicFlowRouteGroup(pathname)).toBe(group);
  });

  it("shares a group across one mount's flow routes and separates other mounts", () => {
    const groupsOf = (paths: ReadonlyArray<string>) =>
      new Set(paths.map(getClassicFlowRouteGroup));
    const mounts = [
      "",
      "/positions/yield/balance/stake",
      "/positions/yield/balance/unstake",
      "/positions/yield/balance/pending-action",
      "/positions/yield/other/stake",
    ];

    for (const base of mounts) {
      expect(
        groupsOf([`${base}/review`, `${base}/steps`, `${base}/complete`]).size
      ).toBe(1);
    }
    expect(groupsOf(mounts.map((base) => `${base}/review`)).size).toBe(
      mounts.length
    );
  });
});
