import { useAtomValue } from "@effect/atom-react";
import { Data, Duration, Effect, Option, Result } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../../../../../app/runtime";
import {
  PAMultiValidatorsRequired,
  PASingleValidatorRequired,
} from "../../../../../../domain";
import type { WalletAddress } from "../../../../../../domain/schema/identifiers";
import type { InitParams } from "../../../../../../domain/schema/init-params";
import { getPositionBalanceDataKey } from "../../../../../../domain/types/positions";
import { YieldApiService } from "../../../../../../services/api/yield-api-service";
import { withApiResourcePolicy } from "../../../../../../shared/effect/api-resource";
import { initParamsAtom } from "../../../../../init-params";
import { preparePendingActionRequestDto } from "../../../../../position-details/support";
import { currentWalletStateAtom } from "../../../../../wallet";
import { YieldOpportunityKey, yieldOpportunityAtom } from "../../../..";

class PendingActionDeepLinkRequestKey extends Data.Class<{
  readonly address: typeof WalletAddress.Type;
  readonly pendingAction: NonNullable<InitParams["pendingaction"]>;
  readonly validator: InitParams["validator"];
  readonly yieldId: NonNullable<InitParams["yieldId"]>;
}> {}

class PendingActionDeepLinkError extends Data.TaggedError(
  "PendingActionDeepLinkError"
)<{
  readonly cause: unknown;
}> {}

const pendingActionDeepLinkResourceAtom = Atom.family(
  (key: PendingActionDeepLinkRequestKey) =>
    appRuntime
      .atom((get) =>
        Effect.gen(function* () {
          const api = yield* YieldApiService;
          const position = yield* api.getSingleYieldBalances({
            address: key.address,
            yieldId: key.yieldId,
          });
          const balance = position.balances.find((item) => {
            if (
              key.validator &&
              item.validator?.address !== key.validator &&
              !item.validators?.some(
                (validator) => validator.address === key.validator
              )
            ) {
              return false;
            }

            return item.pendingActions.some(
              (pendingAction) => pendingAction.type === key.pendingAction
            );
          });
          const pendingAction = balance?.pendingActions.find(
            (item) => item.type === key.pendingAction
          );

          if (!balance || !pendingAction) return null;

          const yieldData = yield* get.result(
            yieldOpportunityAtom(
              new YieldOpportunityKey({ yieldId: key.yieldId })
            )
          );

          if (!yieldData) return null;

          return {
            address: key.address,
            balance,
            pendingAction,
            yieldData,
          };
        }).pipe(
          Effect.mapError((cause) => new PendingActionDeepLinkError({ cause }))
        )
      )
      .pipe(
        withApiResourcePolicy({
          idleTTL: Duration.infinity,
          staleTime: Duration.infinity,
          revalidateOnMount: false,
        })
      )
);

const currentPendingActionDeepLinkAtom = Atom.make((get) => {
  const wallet = get(currentWalletStateAtom);
  const initParams = get(initParamsAtom);

  if (
    wallet.status !== "connected" ||
    !wallet.connector ||
    !initParams?.yieldId ||
    !initParams.pendingaction
  ) {
    return AsyncResult.success(null);
  }

  return get(
    pendingActionDeepLinkResourceAtom(
      new PendingActionDeepLinkRequestKey({
        address: wallet.address,
        pendingAction: initParams.pendingaction,
        validator: initParams.validator,
        yieldId: initParams.yieldId,
      })
    )
  ).pipe(
    AsyncResult.map((value) =>
      value
        ? { ...value, additionalAddresses: wallet.additionalAddresses }
        : null
    )
  );
}).pipe(Atom.withLabel("currentPendingActionDeepLinkAtom"));

export const usePendingActionDeepLink = () => {
  const result = useAtomValue(currentPendingActionDeepLinkAtom);
  const value = result.pipe(AsyncResult.value, Option.getOrUndefined);
  const data = value
    ? (() => {
        const balance = value.balance;
        const balanceId = getPositionBalanceDataKey(balance);

        if (
          PAMultiValidatorsRequired(value.pendingAction) ||
          PASingleValidatorRequired(value.pendingAction)
        ) {
          return {
            type: "positionDetails" as const,
            yieldOp: value.yieldData,
            pendingAction: value.pendingAction,
            balance,
            balanceId,
          };
        }

        const prepared = preparePendingActionRequestDto({
          pendingActionsState: new Map(),
          address: value.address,
          additionalAddresses: value.additionalAddresses,
          integration: value.yieldData,
          yieldBalance: balance,
          pendingActionDto: value.pendingAction,
          selectedValidators: [],
        });
        return Result.isSuccess(prepared)
          ? {
              type: "review" as const,
              yieldOp: value.yieldData,
              pendingActionDto: prepared.success,
              balance,
              balanceId,
            }
          : null;
      })()
    : value;

  return {
    data,
    error: result.pipe(AsyncResult.error, Option.getOrUndefined),
    isLoading: AsyncResult.isInitial(result),
  } as const;
};
