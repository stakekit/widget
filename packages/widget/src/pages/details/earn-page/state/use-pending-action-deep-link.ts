import { useAtomValue } from "@effect/atom-react";
import { Data, Duration, Effect, Option, Result } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { withApiResourcePolicy } from "../../../../atoms/api-resource";
import {
  PAMultiValidatorsRequired,
  PASingleValidatorRequired,
} from "../../../../domain";
import type { AdditionalAddresses } from "../../../../domain/schema/address-models";
import type { WalletAddress } from "../../../../domain/schema/identifiers";
import { getPositionBalanceDataKey } from "../../../../domain/types/positions";
import {
  YieldOpportunityKey,
  yieldOpportunityAtom,
} from "../../../../hooks/api/yield-atoms";
import { StakeKitApiService } from "../../../../providers/api/api-service";
import { widgetAtomRuntime } from "../../../../providers/effect-atom-runtime/widget-runtime";
import { useSettings } from "../../../../providers/settings";
import { useSKWallet } from "../../../../providers/wallet/react/use-wallet";
import {
  WalletInitParamsKey,
  walletInitParamsAtom,
} from "../../../../providers/wallet/wagmi/initialization-params";
import { preparePendingActionRequestDto } from "../../../position-details/hooks/utils";

class PendingActionDeepLinkKey extends Data.Class<{
  readonly additionalAddresses: AdditionalAddresses | null;
  readonly address: typeof WalletAddress.Type | null;
  readonly enabled: boolean;
  readonly externalProviderInitToken: string | null;
}> {}

class PendingActionDeepLinkError extends Data.TaggedError(
  "PendingActionDeepLinkError"
)<{
  readonly cause: unknown;
}> {}

const pendingActionDeepLinkAtom = Atom.family((key: PendingActionDeepLinkKey) =>
  widgetAtomRuntime
    .atom((get) =>
      Effect.gen(function* () {
        if (!key.enabled || !key.address) return null;

        const initParams = yield* get.result(
          walletInitParamsAtom(
            new WalletInitParamsKey({
              externalProviderInitToken: key.externalProviderInitToken,
            })
          )
        );

        if (!initParams.yieldId || !initParams.pendingaction) return null;

        const api = yield* StakeKitApiService;
        const position = yield* api.yield.getSingleYieldBalances({
          address: key.address,
          yieldId: initParams.yieldId,
        });
        const balance = position.balances.find((item) => {
          if (
            initParams.validator &&
            item.validator?.address !== initParams.validator &&
            !item.validators?.some(
              (validator) => validator.address === initParams.validator
            )
          ) {
            return false;
          }

          return item.pendingActions.some(
            (pendingAction) => pendingAction.type === initParams.pendingaction
          );
        });
        const pendingAction = balance?.pendingActions.find(
          (item) => item.type === initParams.pendingaction
        );

        if (!balance || !pendingAction) return null;

        const yieldData = yield* get.result(
          yieldOpportunityAtom(
            new YieldOpportunityKey({ yieldId: initParams.yieldId })
          )
        );

        if (!yieldData) return null;

        return {
          additionalAddresses: key.additionalAddresses,
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

export const usePendingActionDeepLink = () => {
  const { externalProviders } = useSettings();
  const { isConnected, address, connector, additionalAddresses } =
    useSKWallet();
  const result = useAtomValue(
    pendingActionDeepLinkAtom(
      new PendingActionDeepLinkKey({
        additionalAddresses,
        address,
        enabled: !!(isConnected && address && connector),
        externalProviderInitToken: externalProviders?.initToken ?? null,
      })
    )
  );
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
