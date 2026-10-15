import { Data, Effect, Result } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { appRuntime } from "../../../app/runtime/app-runtime";
import { preparePendingActionCommand } from "../../../domain/action/action-command";
import {
  isPendingActionValidatorAddressesRequired,
  isPendingActionValidatorAddressRequired,
} from "../../../domain/action/pending-action";
import { getPositionBalanceDataKey } from "../../../domain/portfolio/positions";
import type { WalletScopeKey } from "../../../domain/wallet/wallet-scope";
import {
  SingleYieldBalancesKey,
  singleYieldBalancesResourceAtom,
} from "../../../resources/single-yield-balances/index";
import {
  YieldOpportunityKey,
  yieldOpportunityAtom,
} from "../../../resources/yield-opportunity/index";
import type { ClassicTransactionWorkflowProviderDetail } from "../../../services/transaction-workflow/transaction-workflow-model";
import type { InitParams } from "../../../services/wallet/init-params";
import { walletScopeFromState } from "../../../services/wallet/wallet-scope-adapter";
import { initParamsAtom } from "../../init-params/index";
import { walletConnectionStateAtom } from "../../wallet/index";
import { findPendingActionDeepLinkTarget } from "../model/pending-action-deep-link";

class PendingActionDeepLinkRequestKey extends Data.Class<{
  readonly balanceId: InitParams["balanceId"];
  readonly pendingAction: NonNullable<InitParams["pendingaction"]>;
  readonly scope: WalletScopeKey;
  readonly validator: InitParams["validator"];
  readonly yieldId: NonNullable<InitParams["yieldId"]>;
}> {}

class PendingActionDeepLinkIntentId extends Data.Class<{
  readonly address: WalletScopeKey["address"];
  readonly balanceId: InitParams["balanceId"];
  readonly network: WalletScopeKey["network"];
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
    appRuntime.atom((get) =>
      Effect.gen(function* () {
        const position = yield* get.result(
          singleYieldBalancesResourceAtom.foreground(
            new SingleYieldBalancesKey({
              address: key.scope.address,
              yieldId: key.yieldId,
            })
          )
        );
        const target = findPendingActionDeepLinkTarget({
          balanceId: key.balanceId,
          balances: position.balances,
          pendingActionType: key.pendingAction,
          validator: key.validator,
        });

        if (!target) return null;
        const { balance, pendingAction } = target;

        const yieldData = yield* get.result(
          yieldOpportunityAtom.foreground(
            new YieldOpportunityKey({ yieldId: key.yieldId })
          )
        );

        return yieldData
          ? {
              address: key.scope.address,
              balance,
              intentId: new PendingActionDeepLinkIntentId({
                address: key.scope.address,
                balanceId: key.balanceId,
                network: key.scope.network,
                pendingAction: key.pendingAction,
                validator: key.validator,
                yieldId: key.yieldId,
              }),
              pendingAction,
              yieldData,
            }
          : null;
      }).pipe(
        Effect.mapError((cause) => new PendingActionDeepLinkError({ cause }))
      )
    )
);

const currentPendingActionDeepLinkAtom = Atom.make((get) => {
  const wallet = get(walletConnectionStateAtom);
  const initParams = get(initParamsAtom);

  if (
    wallet.status !== "connected" ||
    !wallet.connector ||
    !initParams?.yieldId ||
    !initParams.pendingaction
  ) {
    return AsyncResult.success(null);
  }
  const walletScope = walletScopeFromState(wallet);
  if (!walletScope) return AsyncResult.success(null);

  return get(
    pendingActionDeepLinkResourceAtom(
      new PendingActionDeepLinkRequestKey({
        balanceId: initParams.balanceId,
        pendingAction: initParams.pendingaction,
        scope: walletScope,
        validator: initParams.validator,
        yieldId: initParams.yieldId,
      })
    )
  ).pipe(
    AsyncResult.map((value) =>
      value
        ? {
            ...value,
            additionalAddresses: wallet.additionalAddresses,
            walletScope,
          }
        : null
    )
  );
}).pipe(Atom.withLabel("currentPendingActionDeepLinkAtom"));

type PendingActionDeepLinkValue = NonNullable<
  Atom.Type<
    typeof currentPendingActionDeepLinkAtom
  > extends AsyncResult.AsyncResult<infer Value, PendingActionDeepLinkError>
    ? Value
    : never
>;

const projectPendingActionDeepLink = (value: PendingActionDeepLinkValue) => {
  const balance = value.balance;
  const balanceId = getPositionBalanceDataKey(balance);

  if (
    isPendingActionValidatorAddressesRequired(value.pendingAction) ||
    isPendingActionValidatorAddressRequired(value.pendingAction)
  ) {
    return {
      intentId: value.intentId,
      type: "positionDetails" as const,
      yieldOp: value.yieldData,
      pendingAction: value.pendingAction,
      balance,
      balanceId,
      walletScope: value.walletScope,
    };
  }

  const prepared = preparePendingActionCommand({
    pendingActionsState: new Map(),
    address: value.address,
    additionalAddresses: value.additionalAddresses,
    integration: value.yieldData,
    yieldBalance: balance,
    pendingAction: value.pendingAction,
    selectedValidators: [],
  });

  return Result.isSuccess(prepared)
    ? {
        intentId: value.intentId,
        type: "review" as const,
        yieldOp: value.yieldData,
        pendingAction: prepared.success,
        balance,
        balanceId,
        providersDetails: getPendingActionProvidersDetails(value.yieldData),
        walletScope: value.walletScope,
      }
    : null;
};

const getPendingActionProvidersDetails = (
  integration: PendingActionDeepLinkValue["yieldData"]
): ReadonlyArray<ClassicTransactionWorkflowProviderDetail> => {
  const rewardRate = integration.rewardRate.total;
  const provider = integration.provider;

  return [
    {
      logo: provider?.logoURI ?? integration.metadata.logoURI,
      name: provider?.name ?? integration.metadata.name,
      rewardRate,
      rewardType: integration.rewardRate.rateType?.toLowerCase(),
      website: provider?.website,
    },
  ];
};

export const pendingActionDeepLinkViewAtom =
  currentPendingActionDeepLinkAtom.pipe(
    Atom.mapResult((value) =>
      value ? projectPendingActionDeepLink(value) : null
    ),
    Atom.withLabel("pendingActionDeepLinkViewAtom")
  );
