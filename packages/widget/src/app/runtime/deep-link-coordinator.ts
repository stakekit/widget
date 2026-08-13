import { Context, Effect, Layer, Ref, Stream } from "effect";
import { ClassicTransactionFlowService as ClassicFlow } from "../../features/classic-transaction-flow/state/orchestration/classic-transaction-flow-service";
import { getPositionDetailsHubPath } from "../../features/position-details/state";
import {
  toWidgetPath,
  WidgetNavigation,
} from "../../services/navigation/widget-navigation";
import {
  sameWalletScopeOwner,
  type WalletScopeKey,
  walletScopeFromState,
} from "../../services/wallet/wallet-scope";
import { WalletService } from "../../services/wallet/wallet-service";
import { makeScopedSerialOperations } from "../../shared/effect/scoped-serial-operations";

type ClassicFlowStartInput = Parameters<ClassicFlow["Service"]["start"]>[0];

type PendingActionIntent = Readonly<{
  readonly address: WalletScopeKey["address"];
  readonly network: WalletScopeKey["network"];
  readonly pendingAction: string;
  readonly validator: string | null;
  readonly yieldId: string;
}>;

export type PendingActionDeepLinkObservation =
  | Readonly<{
      readonly _tag: "OpenValidatorSelection";
      readonly balanceId: string;
      readonly intent: PendingActionIntent;
      readonly pendingActionType: string;
      readonly walletScope: WalletScopeKey;
      readonly yieldId: string;
    }>
  | Readonly<{
      readonly _tag: "StartClassicFlow";
      readonly input: ClassicFlowStartInput;
      readonly intent: PendingActionIntent;
      readonly walletScope: WalletScopeKey;
    }>;

export type DeepLinkRouteObservation = Readonly<{
  readonly pendingAction: PendingActionDeepLinkObservation | null;
  readonly position: {
    readonly balanceId: string;
    readonly yieldId: string;
  } | null;
  readonly ready: boolean;
}>;

type DeepLinkCoordinatorService = Readonly<{
  readonly observe: (
    observations: Stream.Stream<DeepLinkRouteObservation>
  ) => Effect.Effect<void>;
}>;

type DeepLinkClaims = Readonly<{
  readonly claimed: ReadonlySet<string>;
  readonly reserved: ReadonlySet<string>;
}>;

const pendingActionClaimKey = (intent: PendingActionIntent) =>
  JSON.stringify([
    "pending-action",
    intent.address.toLowerCase(),
    intent.network,
    intent.pendingAction,
    intent.validator,
    intent.yieldId,
  ]);

const positionClaimKey = ({
  balanceId,
  yieldId,
}: NonNullable<DeepLinkRouteObservation["position"]>) =>
  JSON.stringify(["position", yieldId, balanceId]);

export class DeepLinkCoordinator extends Context.Service<
  DeepLinkCoordinator,
  DeepLinkCoordinatorService
>()("stakekit/widget/app/DeepLinkCoordinator") {
  static readonly layer = Layer.effect(
    DeepLinkCoordinator,
    Effect.gen(function* () {
      const classicFlow = yield* ClassicFlow;
      const navigation = yield* WidgetNavigation;
      const serial = yield* makeScopedSerialOperations();
      const wallet = yield* WalletService;
      const claims = yield* Ref.make<DeepLinkClaims>({
        claimed: new Set(),
        reserved: new Set(),
      });
      const releaseClaim = (key: string) =>
        Ref.update(claims, (current) => {
          const reserved = new Set(current.reserved);
          reserved.delete(key);
          return { ...current, reserved };
        });

      const claimAfter = Effect.fn("DeepLinkCoordinator.claimAfter")(function* (
        key: string,
        operation: () => Effect.Effect<boolean, unknown, never>
      ) {
        const reserved = yield* Ref.modify(claims, (current) => {
          if (current.claimed.has(key) || current.reserved.has(key)) {
            return [false, current];
          }
          return [
            true,
            {
              ...current,
              reserved: new Set(current.reserved).add(key),
            },
          ];
        });
        if (!reserved) return;

        const accepted = yield* operation().pipe(
          Effect.onError(() => releaseClaim(key))
        );
        if (!accepted) {
          yield* releaseClaim(key);
          return;
        }
        yield* Ref.update(claims, (current) => {
          const nextReserved = new Set(current.reserved);
          nextReserved.delete(key);
          return {
            claimed: new Set(current.claimed).add(key),
            reserved: nextReserved,
          };
        });
      });

      const walletOwns = Effect.fn("DeepLinkCoordinator.walletOwns")(function* (
        pendingAction: PendingActionDeepLinkObservation
      ) {
        const state = yield* wallet.state;
        const scope = walletScopeFromState(state.connection);
        return (
          scope !== null &&
          sameWalletScopeOwner(scope, pendingAction.walletScope)
        );
      });

      const walletIsConnected = wallet.state.pipe(
        Effect.map((state) => state.connection.status === "connected")
      );

      const openPendingAction = (
        pendingAction: PendingActionDeepLinkObservation
      ) => {
        if (pendingAction._tag === "OpenValidatorSelection") {
          return navigation
            .execute({
              _tag: "Push",
              path: toWidgetPath(
                `/positions/${pendingAction.yieldId}/${pendingAction.balanceId}/select-validator/${pendingAction.pendingActionType}`
              ),
            })
            .pipe(Effect.as(true));
        }

        return classicFlow
          .start(pendingAction.input)
          .pipe(Effect.map((outcome) => outcome._tag === "Started"));
      };

      const consider = Effect.fn("DeepLinkCoordinator.consider")(function* (
        observation: DeepLinkRouteObservation
      ): Effect.fn.Return<void, unknown, never> {
        if (!observation.ready) return;

        if (observation.position) {
          if (!(yield* walletIsConnected)) return;
          const position = observation.position;
          yield* claimAfter(positionClaimKey(position), () =>
            navigation
              .execute({
                _tag: "Push",
                path: toWidgetPath(
                  getPositionDetailsHubPath({
                    balanceId: position.balanceId,
                    integrationId: position.yieldId,
                  })
                ),
              })
              .pipe(Effect.as(true))
          );
          return;
        }

        const pendingAction = observation.pendingAction;
        if (!pendingAction || !(yield* walletOwns(pendingAction))) return;
        yield* claimAfter(pendingActionClaimKey(pendingAction.intent), () =>
          openPendingAction(pendingAction)
        );
      });

      const observe = (
        observations: Stream.Stream<DeepLinkRouteObservation>
      ): Effect.Effect<void> =>
        observations.pipe(
          Stream.changes,
          Stream.runForEach((observation) =>
            serial.run(consider(observation)).pipe(Effect.ignore)
          )
        );

      return DeepLinkCoordinator.of({ observe });
    })
  );
}
