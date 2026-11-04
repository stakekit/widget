import { describe, expect, it, vi } from "@effect/vitest";
import { Effect, Layer, Option, Schema, Stream } from "effect";
import {
  DeepLinkCoordinator,
  type DeepLinkRouteObservation,
} from "../../../src/app/runtime/deep-link-coordinator";
import { EarnBalance } from "../../../src/domain/earn/models";
import {
  WalletAddress,
  YieldId,
} from "../../../src/domain/identity/identifiers";
import { BalanceDataKey } from "../../../src/domain/portfolio/positions";
import { WalletScopeKey } from "../../../src/domain/wallet/wallet-scope";
import { findPendingActionDeepLinkTarget } from "../../../src/features/earn/model/pending-action-deep-link";
import { yieldFlowRoutes } from "../../../src/features/yield-transaction-flow/model/yield-transaction-flow";
import {
  type WidgetNavigationCommand,
  WidgetNavigationError,
  type WidgetNavigationOptions,
} from "../../../src/services/navigation/widget-navigation";
import {
  type WidgetPath,
  widgetTargetPath,
  widgetTargetState,
} from "../../../src/services/navigation/widget-routes";
import {
  disconnectedLedgerConnectorState,
  disconnectedNormalizedWalletState,
  type WalletState,
} from "../../../src/services/wallet/wallet-state";
import { yieldApiValidatorFixture, yieldBalanceFixture } from "../../fixtures";
import { makeConnectedWalletState } from "../../fixtures/wallet-state";
import { makeTestWallet } from "../../utils/services/wallet-service";
import { makeTestNavigation } from "../../utils/services/widget-navigation";

const address = Schema.decodeSync(WalletAddress)(
  "0x0000000000000000000000000000000000000001"
);
const otherAddress = Schema.decodeSync(WalletAddress)(
  "0x0000000000000000000000000000000000000002"
);
const scope = new WalletScopeKey({ address, network: "ethereum" });
const yieldId = Schema.decodeSync(YieldId)("yield-1");
const decodeBalanceDataKey = Schema.decodeSync(BalanceDataKey);

const pendingObservation = (ownerScope = scope): DeepLinkRouteObservation => ({
  maintenance: false,
  pendingAction: {
    _tag: "StartYieldFlow",
    input: {
      intake: { walletScope: ownerScope } as never,
      mount: {
        _tag: "PositionManage",
        balanceId: "default",
        integrationId: yieldId,
      },
    },
    intent: {
      address: ownerScope.address,
      network: ownerScope.network,
      pendingAction: "CLAIM_REWARDS",
      validator: null,
      yieldId,
    },
    walletScope: ownerScope,
  },
  position: null,
  ready: true,
});

type CoordinatorTestOptions = Readonly<{
  readonly connected?: boolean;
  readonly navigate?: (
    path: WidgetPath,
    options?: WidgetNavigationOptions
  ) => Effect.Effect<void, WidgetNavigationError>;
  readonly owner?: typeof address;
  readonly ownerScopes?: ReadonlyArray<WalletScopeKey>;
}>;

const disconnectedWalletState: WalletState = {
  connection: disconnectedNormalizedWalletState,
  ledger: disconnectedLedgerConnectorState,
};

const makeCoordinatorTestKit = Effect.fn("makeCoordinatorTestKit")(function* ({
  connected = true,
  navigate = () => Effect.void,
  owner = address,
  ownerScopes,
}: CoordinatorTestOptions) {
  const scopes = ownerScopes ?? [
    new WalletScopeKey({ address: owner, network: "ethereum" }),
  ];
  const wallet = yield* makeTestWallet({
    initialState: connected
      ? makeConnectedWalletState(scopes[0] ?? scope)
      : disconnectedWalletState,
  });
  const navigation = yield* makeTestNavigation({
    execute: (command) =>
      command._tag === "Push"
        ? navigate(widgetTargetPath(command.to), command)
        : Effect.void,
  });

  return {
    layer: DeepLinkCoordinator.layer.pipe(
      Layer.provide(Layer.mergeAll(navigation.layer, wallet.layer))
    ),
    navigation,
    scopes,
    wallet,
  } as const;
});

/** The Flow Sessions Start navigated to Review with. */
const startedSessions = (commands: ReadonlyArray<WidgetNavigationCommand>) =>
  commands.flatMap((command) =>
    command._tag === "Push"
      ? yieldFlowRoutes.PositionManage.state(
          widgetTargetState(command.to)
        ).pipe(
          Option.match({
            onNone: () => [],
            onSome: ({ yieldFlowSession }) => [
              {
                path: widgetTargetPath(command.to),
                session: yieldFlowSession,
              },
            ],
          })
        )
      : []
  );

const runObservations = Effect.fn("runObservations")(function* (
  observations: ReadonlyArray<DeepLinkRouteObservation>,
  options: CoordinatorTestOptions = {}
) {
  const kit = yield* makeCoordinatorTestKit(options);
  const observationStream = Stream.fromIterable(
    observations.map((observation, index) => ({
      observation,
      walletState:
        options.connected === false
          ? disconnectedWalletState
          : makeConnectedWalletState(
              kit.scopes[Math.min(index, kit.scopes.length - 1)] ?? scope
            ),
    }))
  ).pipe(
    Stream.mapEffect(({ observation, walletState: nextWalletState }) =>
      kit.wallet.setState(nextWalletState).pipe(Effect.as(observation))
    )
  );

  yield* Effect.scoped(
    DeepLinkCoordinator.use((coordinator) =>
      coordinator.observe(observationStream)
    ).pipe(Effect.provide(kit.layer))
  );
  return { started: startedSessions(yield* kit.navigation.commands) };
});

describe("DeepLinkCoordinator", () => {
  it.effect("waits for readiness and starts a pending-action Flow once", () =>
    Effect.gen(function* () {
      const pending = pendingObservation();

      const { started } = yield* runObservations([
        { ...pending, ready: false },
        pending,
        { ...pending, ready: false },
        pending,
      ]);

      expect(pending.pendingAction?._tag).toBe("StartYieldFlow");
      expect(started).toHaveLength(1);
      expect(started[0]?.path).toBe(
        "/positions/yield-1/default/pending-action/review"
      );
      expect(started[0]?.session.mount).toEqual({
        _tag: "PositionManage",
        balanceId: "default",
        integrationId: "yield-1",
      });
      expect(started[0]?.session.intake.walletScope).toEqual(scope);
    })
  );

  it.effect("does not start a pending-action Flow during maintenance", () =>
    Effect.gen(function* () {
      const { started } = yield* runObservations([
        { ...pendingObservation(), maintenance: true },
      ]);

      expect(started).toEqual([]);
    })
  );

  it.effect(
    "rejects a pending-action intent after its wallet owner changes",
    () =>
      Effect.gen(function* () {
        const { started } = yield* runObservations([pendingObservation()], {
          owner: otherAddress,
        });

        expect(started).toEqual([]);
      })
  );

  it.effect("claims case-distinct non-EVM wallet owners separately", () =>
    Effect.gen(function* () {
      const firstAddress =
        yield* Schema.decodeEffect(WalletAddress)("CaseSensitiveOwner");
      const secondAddress =
        yield* Schema.decodeEffect(WalletAddress)("casesensitiveowner");
      const firstScope = new WalletScopeKey({
        address: firstAddress,
        network: "solana",
      });
      const secondScope = new WalletScopeKey({
        address: secondAddress,
        network: "solana",
      });

      const { started } = yield* runObservations(
        [pendingObservation(firstScope), pendingObservation(secondScope)],
        { ownerScopes: [firstScope, secondScope] }
      );

      expect(
        started.map(({ session }) => session.intake.walletScope.address)
      ).toEqual([firstAddress, secondAddress]);
    })
  );

  it.effect(
    "retries an unclaimed position intent on the next meaningful observation",
    () =>
      Effect.gen(function* () {
        const navigate = vi
          .fn<
            (path: WidgetPath) => Effect.Effect<void, WidgetNavigationError>
          >()
          .mockReturnValueOnce(
            Effect.fail(
              new WidgetNavigationError({
                cause: new Error("navigation failed"),
              })
            )
          )
          .mockReturnValue(Effect.void);
        const position = {
          maintenance: false,
          pendingAction: null,
          position: { balanceId: "default", yieldId },
          ready: true,
        } satisfies DeepLinkRouteObservation;

        yield* runObservations(
          [
            position,
            { ...position, ready: false },
            position,
            { ...position, ready: false },
            position,
          ],
          { navigate }
        );

        expect(navigate).toHaveBeenCalledTimes(2);
        expect(navigate).toHaveBeenCalledWith(
          "/positions/yield-1/default",
          expect.anything()
        );
      })
  );

  it.effect("revalidates the current wallet before position navigation", () =>
    Effect.gen(function* () {
      const navigate = vi.fn(() => Effect.void);

      yield* runObservations(
        [
          {
            maintenance: false,
            pendingAction: null,
            position: { balanceId: "default", yieldId },
            ready: true,
          },
        ],
        { connected: false, navigate }
      );

      expect(navigate).not.toHaveBeenCalled();
    })
  );
});

describe("findPendingActionDeepLinkTarget", () => {
  const claimAction = (passthrough: string) => ({
    intent: "manage" as const,
    passthrough,
    type: "CLAIM_REWARDS" as const,
  });
  const validatorA = yieldApiValidatorFixture({ address: "validator-a" });
  const validatorB = yieldApiValidatorFixture({ address: "validator-b" });
  const balances = [
    yieldBalanceFixture({
      pendingActions: [claimAction("claim-a")],
      type: "claimable",
      validator: validatorA,
    }),
    yieldBalanceFixture({
      pendingActions: [],
      type: "active",
      validator: validatorB,
    }),
    yieldBalanceFixture({
      pendingActions: [claimAction("claim-b")],
      type: "claimable",
      validator: validatorB,
    }),
  ].map((balance) => Schema.decodeSync(EarnBalance)(balance));

  it("targets the balance matching balanceId even when an earlier balance has the same action", () => {
    const target = findPendingActionDeepLinkTarget({
      balanceId: decodeBalanceDataKey("validator::validator-b"),
      balances,
      pendingActionType: "CLAIM_REWARDS",
      validator: null,
    });

    expect(target?.pendingAction.passthrough).toBe("claim-b");
    expect(target?.balance.validator?.address).toBe("validator-b");
  });

  it("returns no action for an unknown balanceId", () => {
    expect(
      findPendingActionDeepLinkTarget({
        balanceId: decodeBalanceDataKey("validator::unknown"),
        balances,
        pendingActionType: "CLAIM_REWARDS",
        validator: null,
      })
    ).toBeNull();
  });

  it("returns no action when the matching balance lacks the action type", () => {
    expect(
      findPendingActionDeepLinkTarget({
        balanceId: decodeBalanceDataKey("validator::validator-b"),
        balances,
        pendingActionType: "UNLOCK_LOCKED",
        validator: null,
      })
    ).toBeNull();
  });

  it("keeps the first balance with the action when balanceId is absent", () => {
    expect(
      findPendingActionDeepLinkTarget({
        balanceId: null,
        balances,
        pendingActionType: "CLAIM_REWARDS",
        validator: null,
      })?.pendingAction.passthrough
    ).toBe("claim-a");
  });
});
