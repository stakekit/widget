import { useAtomValue } from "@effect/atom-react";
import { Data, Duration, Effect, Option, Schema } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import {
  valueEqualAtomFamily,
  withApiResourcePolicy,
} from "../../../../atoms/api-resource";
import {
  PAMultiValidatorsRequired,
  PASingleValidatorRequired,
} from "../../../../domain";
import type { AdditionalAddresses } from "../../../../domain/schema/address-models";
import { EarnYieldBalancesResponse } from "../../../../domain/schema/earn-models";
import { WalletAddress } from "../../../../domain/schema/identifiers";
import { getPositionBalanceDataKey } from "../../../../domain/types/positions";
import {
  YieldOpportunityKey,
  yieldOpportunityAtom,
} from "../../../../hooks/api/yield-atoms";
import { StakeKitApiService } from "../../../../providers/api/api-client";
import { stakeKitApiRuntime } from "../../../../providers/effect-atom-runtime/stakekit-api-service";
import { useSettings } from "../../../../providers/settings";
import { useSKWallet } from "../../../../providers/sk-wallet";
import {
  WalletInitParamsKey,
  walletInitParamsAtom,
} from "../../../../providers/wagmi/atoms";
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

const pendingActionDeepLinkAtom = valueEqualAtomFamily(
  (key: PendingActionDeepLinkKey) =>
    stakeKitApiRuntime
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
          const response = yield* api.yield.YieldsControllerGetYieldBalances(
            initParams.yieldId,
            { payload: { address: key.address } }
          );
          const position = yield* Schema.decodeUnknownEffect(
            EarnYieldBalancesResponse
          )(response);
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
              new YieldOpportunityKey({
                decodeIssue: null,
                yieldId: initParams.yieldId,
              })
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
  const {
    isConnected,
    address: rawAddress,
    connector,
    additionalAddresses,
  } = useSKWallet();
  const address = rawAddress
    ? Schema.decodeUnknownSync(WalletAddress)(rawAddress)
    : null;
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

        return preparePendingActionRequestDto({
          pendingActionsState: new Map(),
          address: value.address,
          additionalAddresses: value.additionalAddresses,
          integration: value.yieldData,
          yieldBalance: balance,
          pendingActionDto: value.pendingAction,
          selectedValidators: [],
        })
          .map((pendingActionDto) => ({
            type: "review" as const,
            yieldOp: value.yieldData,
            pendingActionDto,
            balance,
            balanceId,
          }))
          .toMaybe()
          .extractNullable();
      })()
    : value;

  return {
    data,
    error: result.pipe(AsyncResult.error, Option.getOrUndefined),
    isLoading: AsyncResult.isInitial(result),
  } as const;
};
