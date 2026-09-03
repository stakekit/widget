import { describe, expect, it, vi } from "@effect/vitest";
import { Effect, Layer, Schema, Stream } from "effect";
import {
  DeepLinkCoordinator,
  type DeepLinkRouteObservation,
} from "../../src/app/runtime/deep-link-coordinator";
import { WalletAddress } from "../../src/domain/identity/identifiers";
import { WalletScopeKey } from "../../src/domain/wallet/wallet-scope";
import { resolveClassicTransactionFlowStart } from "../../src/features/classic-transaction-flow/model/classic-transaction-flow";
import { ClassicTransactionFlowService } from "../../src/features/classic-transaction-flow/state/orchestration/classic-transaction-flow-service";
import {
  WidgetNavigationError,
  type WidgetNavigationOptions,
  type WidgetPath,
} from "../../src/services/navigation/widget-navigation";
import {
  disconnectedLedgerConnectorState,
  disconnectedNormalizedWalletState,
  type WalletState,
} from "../../src/services/wallet/wallet-state";
import { makeConnectedWalletState } from "../fixtures/wallet-state";
import { makeTestWallet } from "../utils/services/wallet-service";
import { makeTestNavigation } from "../utils/services/widget-navigation";

const address = Schema.decodeSync(WalletAddress)(
  "0x0000000000000000000000000000000000000001"
);
const otherAddress = Schema.decodeSync(WalletAddress)(
  "0x0000000000000000000000000000000000000002"
);
const scope = new WalletScopeKey({ address, network: "ethereum" });

const pendingObservation = (ownerScope = scope): DeepLinkRouteObservation => ({
  maintenance: false,
  pendingAction: {
    _tag: "StartClassicFlow",
    input: {
      intake: { walletScope: ownerScope } as never,
      mount: {
        _tag: "PositionManage",
        balanceId: "balance-1",
        integrationId: "yield-1",
      },
    },
    intent: {
      address: ownerScope.address,
      network: ownerScope.network,
      pendingAction: "CLAIM_REWARDS",
      validator: null,
      yieldId: "yield-1",
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
  readonly start: ClassicTransactionFlowService["Service"]["start"];
}>;

const disconnectedWalletState: WalletState = {
  connection: disconnectedNormalizedWalletState,
  ledger: disconnectedLedgerConnectorState,
};

const startFlow = (
  input: Parameters<ClassicTransactionFlowService["Service"]["start"]>[0]
) => {
  const resolved = resolveClassicTransactionFlowStart(
    input,
    input.intake.walletScope
  );
  return Effect.succeed({
    _tag: "Started",
    session: { ...resolved.session, epoch: 1 },
  } as const);
};

const makeCoordinatorTestKit = Effect.fn("makeCoordinatorTestKit")(function* ({
  connected = true,
  navigate = () => Effect.void,
  owner = address,
  ownerScopes,
  start,
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
      command._tag === "Push" ? navigate(command.path, command) : Effect.void,
  });
  const dependencies = Layer.mergeAll(
    navigation.layer,
    wallet.layer,
    Layer.succeed(
      ClassicTransactionFlowService,
      ClassicTransactionFlowService.of({
        acquireSession: () =>
          Effect.die(
            "makeCoordinatorTestKit: unexpected call to ClassicTransactionFlowService.acquireSession"
          ),
        currentSession: Stream.never,
        start,
      })
    )
  );

  return {
    layer: DeepLinkCoordinator.layer.pipe(Layer.provide(dependencies)),
    scopes,
    wallet,
  } as const;
});

const runObservations = Effect.fn("runObservations")(function* (
  observations: ReadonlyArray<DeepLinkRouteObservation>,
  options: CoordinatorTestOptions
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
});

describe("DeepLinkCoordinator", () => {
  it.effect("waits for readiness and starts a pending-action Flow once", () =>
    Effect.gen(function* () {
      const start = vi.fn(startFlow);
      const pending = pendingObservation();

      yield* runObservations(
        [
          { ...pending, ready: false },
          pending,
          { ...pending, ready: false },
          pending,
        ],
        { start }
      );

      expect(start).toHaveBeenCalledOnce();
      expect(pending.pendingAction?._tag).toBe("StartClassicFlow");
      if (pending.pendingAction?._tag === "StartClassicFlow") {
        expect(start).toHaveBeenCalledWith(pending.pendingAction.input);
      }
    })
  );

  it.effect("does not start a pending-action Flow during maintenance", () =>
    Effect.gen(function* () {
      const start = vi.fn(startFlow);

      yield* runObservations([{ ...pendingObservation(), maintenance: true }], {
        start,
      });

      expect(start).not.toHaveBeenCalled();
    })
  );

  it.effect(
    "rejects a pending-action intent after its wallet owner changes",
    () =>
      Effect.gen(function* () {
        const start = vi.fn(startFlow);

        yield* runObservations([pendingObservation()], {
          owner: otherAddress,
          start,
        });

        expect(start).not.toHaveBeenCalled();
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
      const start = vi.fn(startFlow);

      yield* runObservations(
        [pendingObservation(firstScope), pendingObservation(secondScope)],
        { ownerScopes: [firstScope, secondScope], start }
      );

      expect(start).toHaveBeenCalledTimes(2);
    })
  );

  it.effect(
    "retries an unclaimed position intent on the next meaningful observation",
    () =>
      Effect.gen(function* () {
        const start = vi.fn();
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
          position: { balanceId: "balance-1", yieldId: "yield-1" },
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
          { navigate, start }
        );

        expect(navigate).toHaveBeenCalledTimes(2);
        expect(navigate).toHaveBeenCalledWith(
          "/positions/yield-1/balance-1",
          expect.anything()
        );
      })
  );

  it.effect("revalidates the current wallet before position navigation", () =>
    Effect.gen(function* () {
      const navigate = vi.fn(() => Effect.void);
      const start = vi.fn();

      yield* runObservations(
        [
          {
            maintenance: false,
            pendingAction: null,
            position: { balanceId: "balance-1", yieldId: "yield-1" },
            ready: true,
          },
        ],
        { connected: false, navigate, start }
      );

      expect(navigate).not.toHaveBeenCalled();
    })
  );
});
