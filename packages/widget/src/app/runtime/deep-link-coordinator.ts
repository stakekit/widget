import { Context, Effect, Layer, Ref, Stream } from "effect";
import type { YieldPendingActionType } from "../../domain/action/pending-action";
import type {
  ValidatorAddress,
  YieldId,
} from "../../domain/identity/identifiers";
import type { BalanceDataKey } from "../../domain/portfolio/positions";
import {
  sameWalletScopeOwner,
  type WalletScopeKey,
  walletScopeOwnerKey,
} from "../../domain/wallet/wallet-scope";
import { makeStartYieldTransactionFlow } from "../../features/yield-transaction-flow/runtime";
import {
  WidgetNavigation,
  type WidgetNavigationError,
} from "../../services/navigation/widget-navigation";
import { widgetRoutes } from "../../services/navigation/widget-routes";
import type { WalletRuntimeInvariantError } from "../../services/wallet/wallet-errors";
import { walletScopeFromState } from "../../services/wallet/wallet-scope-adapter";
import { WalletService } from "../../services/wallet/wallet-service";
import { makeScopedSerialOperations } from "../../shared/effect/scoped-serial-operations";

type YieldFlowStartInput = Parameters<
  Effect.Success<typeof makeStartYieldTransactionFlow>
>[0];

type PendingActionIntent = Readonly<{
  readonly address: WalletScopeKey["address"];
  readonly network: WalletScopeKey["network"];
  readonly pendingAction: YieldPendingActionType;
  readonly validator: ValidatorAddress | null;
  readonly yieldId: YieldId;
}>;

export type PendingActionDeepLinkObservation =
  | Readonly<{
      readonly _tag: "OpenValidatorSelection";
      readonly balanceId: BalanceDataKey;
      readonly intent: PendingActionIntent;
      readonly pendingActionType: YieldPendingActionType;
      readonly walletScope: WalletScopeKey;
      readonly yieldId: YieldId;
    }>
  | Readonly<{
      readonly _tag: "StartYieldFlow";
      readonly input: YieldFlowStartInput;
      readonly intent: PendingActionIntent;
      readonly walletScope: WalletScopeKey;
    }>;

export type DeepLinkRouteObservation = Readonly<{
  readonly maintenance: boolean;
  readonly pendingAction: PendingActionDeepLinkObservation | null;
  readonly position: {
    readonly balanceId: BalanceDataKey;
    readonly yieldId: YieldId;
  } | null;
  readonly ready: boolean;
}>;

type DeepLinkOperationError =
  | WalletRuntimeInvariantError
  | WidgetNavigationError;

type DeepLinkCoordinatorService = Readonly<{
  readonly observe: (
    observations: Stream.Stream<DeepLinkRouteObservation>
  ) => Effect.Effect<void>;
}>;

type DeepLinkClaims = Readonly<{
  readonly claimed: ReadonlySet<string>;
  readonly reserved: ReadonlySet<string>;
}>;

const pendingActionClaimKey = (intent: PendingActionIntent) => {
  const owner = walletScopeOwnerKey(intent);

  return JSON.stringify([
    "pending-action",
    owner.address,
    owner.network,
    intent.pendingAction,
    intent.validator,
    intent.yieldId,
  ]);
};

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
      const startYieldFlow = yield* makeStartYieldTransactionFlow;
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
        operation: () => Effect.Effect<boolean, DeepLinkOperationError, never>
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
        // Both Layouts mount position details and its validator selection.
        if (pendingAction._tag === "OpenValidatorSelection") {
          return navigation
            .execute({
              _tag: "Push",
              to: widgetRoutes.positionSelectValidator.build({
                balanceId: pendingAction.balanceId,
                integrationId: pendingAction.yieldId,
                pendingActionType: pendingAction.pendingActionType,
              }),
            })
            .pipe(Effect.as(true));
        }

        return startYieldFlow(pendingAction.input).pipe(
          Effect.map((outcome) => outcome._tag === "Started")
        );
      };

      const consider = Effect.fn("DeepLinkCoordinator.consider")(function* (
        observation: DeepLinkRouteObservation
      ): Effect.fn.Return<void, DeepLinkOperationError, never> {
        if (observation.maintenance || !observation.ready) return;

        if (observation.position) {
          if (!(yield* walletIsConnected)) return;
          const position = observation.position;
          yield* claimAfter(positionClaimKey(position), () =>
            navigation
              .execute({
                _tag: "Push",
                to: widgetRoutes.positionDetails.build({
                  balanceId: position.balanceId,
                  integrationId: position.yieldId,
                }),
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
