import { Effect, Layer, Schema, Stream } from "effect";
import { describe, expect, it, vi } from "vitest";
import {
  DeepLinkCoordinator,
  type DeepLinkRouteObservation,
} from "../../src/app/runtime/deep-link-coordinator";
import { WalletAddress } from "../../src/domain/identity/identifiers";
import { ClassicTransactionFlowService } from "../../src/features/classic-transaction-flow/state/orchestration/classic-transaction-flow-service";
import {
  makeWidgetNavigation,
  WidgetNavigation,
  WidgetNavigationError,
  type WidgetPath,
} from "../../src/services/navigation/widget-navigation";
import { WalletScopeKey } from "../../src/services/wallet/wallet-scope";
import { WalletService } from "../../src/services/wallet/wallet-service";
import {
  disconnectedLedgerConnectorState,
  disconnectedNormalizedWalletState,
} from "../../src/services/wallet/wallet-state";

const address = Schema.decodeSync(WalletAddress)(
  "0x0000000000000000000000000000000000000001"
);
const otherAddress = Schema.decodeSync(WalletAddress)(
  "0x0000000000000000000000000000000000000002"
);
const scope = new WalletScopeKey({ address, network: "ethereum" });

const walletState = (owner = address) => ({
  connection: {
    additionalAddresses: null,
    address: owner,
    chain: {} as never,
    connector: {} as never,
    connectorChains: [],
    isLedgerLive: false,
    isLedgerLiveAccountPlaceholder: false,
    ledgerAccounts: [],
    network: "ethereum" as const,
    status: "connected" as const,
  },
  ledger: disconnectedLedgerConnectorState,
});

const pendingObservation = (): DeepLinkRouteObservation => ({
  pendingAction: {
    _tag: "StartClassicFlow",
    input: {
      intake: { walletScope: scope } as never,
      mount: {
        _tag: "PositionManage",
        balanceId: "balance-1",
        integrationId: "yield-1",
      },
    },
    intent: {
      address,
      network: "ethereum",
      pendingAction: "CLAIM_REWARDS",
      validator: null,
      yieldId: "yield-1",
    },
    walletScope: scope,
  },
  position: null,
  ready: true,
});

const makeLayer = ({
  connected = true,
  navigate = () => Effect.void,
  owner = address,
  start,
}: {
  readonly connected?: boolean;
  readonly navigate?: (
    path: WidgetPath
  ) => Effect.Effect<void, WidgetNavigationError>;
  readonly owner?: typeof address;
  readonly start: ReturnType<typeof vi.fn>;
}) => {
  const navigation = makeWidgetNavigation({
    back: () => Effect.void,
    push: navigate,
    replace: () => Effect.void,
  });
  return DeepLinkCoordinator.layer.pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(WidgetNavigation, navigation),
        Layer.succeed(
          ClassicTransactionFlowService,
          ClassicTransactionFlowService.of({
            acquireSession: () => Effect.succeed({ _tag: "RejectedStale" }),
            currentSession: Stream.never,
            start,
          } as never)
        ),
        Layer.succeed(
          WalletService,
          WalletService.of({
            state: Effect.succeed(
              connected
                ? walletState(owner)
                : {
                    connection: disconnectedNormalizedWalletState,
                    ledger: disconnectedLedgerConnectorState,
                  }
            ),
            states: Stream.never,
            wagmiConfig: {},
          } as never)
        )
      )
    )
  );
};

const runObservations = (
  observations: ReadonlyArray<DeepLinkRouteObservation>,
  layer: ReturnType<typeof makeLayer>
) =>
  Effect.runPromise(
    Effect.scoped(
      DeepLinkCoordinator.use((coordinator) =>
        coordinator.observe(Stream.fromIterable(observations))
      ).pipe(Effect.provide(layer))
    )
  );

describe("DeepLinkCoordinator", () => {
  it("waits for readiness and starts a pending-action Flow once", async () => {
    const start = vi.fn(() =>
      Effect.succeed({ _tag: "Started", session: {} } as const)
    );
    const pending = pendingObservation();

    await runObservations(
      [
        { ...pending, ready: false },
        pending,
        { ...pending, ready: false },
        pending,
      ],
      makeLayer({ start })
    );

    expect(start).toHaveBeenCalledOnce();
    expect(pending.pendingAction?._tag).toBe("StartClassicFlow");
    if (pending.pendingAction?._tag === "StartClassicFlow") {
      expect(start).toHaveBeenCalledWith(pending.pendingAction.input);
    }
  });

  it("rejects a pending-action intent after its wallet owner changes", async () => {
    const start = vi.fn(() =>
      Effect.succeed({ _tag: "Started", session: {} } as const)
    );

    await runObservations(
      [pendingObservation()],
      makeLayer({ owner: otherAddress, start })
    );

    expect(start).not.toHaveBeenCalled();
  });

  it("retries an unclaimed position intent on the next meaningful observation", async () => {
    const start = vi.fn();
    const navigate = vi
      .fn<(path: WidgetPath) => Effect.Effect<void, WidgetNavigationError>>()
      .mockReturnValueOnce(
        Effect.fail(
          new WidgetNavigationError({
            cause: new Error("navigation failed"),
          })
        )
      )
      .mockReturnValue(Effect.void);
    const position = {
      pendingAction: null,
      position: { balanceId: "balance-1", yieldId: "yield-1" },
      ready: true,
    } satisfies DeepLinkRouteObservation;

    await runObservations(
      [
        position,
        { ...position, ready: false },
        position,
        { ...position, ready: false },
        position,
      ],
      makeLayer({ navigate, start })
    );

    expect(navigate).toHaveBeenCalledTimes(2);
    expect(navigate).toHaveBeenCalledWith(
      "/positions/yield-1/balance-1",
      expect.anything()
    );
  });

  it("revalidates the current wallet before position navigation", async () => {
    const navigate = vi.fn(() => Effect.void);
    const start = vi.fn();

    await runObservations(
      [
        {
          pendingAction: null,
          position: { balanceId: "balance-1", yieldId: "yield-1" },
          ready: true,
        },
      ],
      makeLayer({ connected: false, navigate, start })
    );

    expect(navigate).not.toHaveBeenCalled();
  });
});
