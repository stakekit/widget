import BigNumber from "bignumber.js";
import { Option, Schema } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import {
  getPendingActionStateKey,
  type PendingActionStateKey,
} from "../../../domain/action/action-command";
import type { PendingAction } from "../../../domain/action/models";
import {
  getPendingActionAmountConfig,
  isPendingActionAmountRequired,
} from "../../../domain/action/pending-action";
import { getYieldActionArg, isERC4626 } from "../../../domain/earn/yield";
import {
  exactZero,
  truncateToTokenDecimals,
} from "../../../domain/finance/exact";
import { getTokenPriceInUSD } from "../../../domain/finance/price";
import { YieldId } from "../../../domain/identity/identifiers";
import type { PositionBalancesByType } from "../../../domain/portfolio/positions";
import { PricesKey, pricesAtom } from "../../../resources/token-prices/index";
import {
  YieldOpportunityKey,
  yieldOpportunityAtom,
} from "../../../resources/yield-opportunity/index";
import {
  PositionBalancesKey,
  positionBalancesAtom,
  positionBalancesByTypeAtom,
} from "../../../resources/yield-positions/index";
import { config } from "../../../shared/config/widget-defaults";
import { formatUsd } from "../../../shared/lib/formatters";
import { getYieldAmountConstraints } from "../../yield-entry/index";
import { resolvePositionDetailsExitReceiveTokenSelection } from "../model/exit-receive-token";
import {
  type PendingActionAmountChange,
  type PositionDetailsWorkflowAction,
  type PositionDetailsWorkflowKey,
  type PositionDetailsWorkflowState,
  positionDetailsWorkflowAtom,
  reducePositionDetailsWorkflow,
} from "./workflow";

const getPendingActionIndex = (
  positionBalancesByType: PositionBalancesByType | null
) =>
  new Map(
    positionBalancesByType
      ? [...positionBalancesByType.values()].flatMap((balances) =>
          balances.flatMap((balance) =>
            balance.pendingActions.map(
              (pendingAction) =>
                [
                  getPendingActionStateKey({
                    actionType: pendingAction.type,
                    balanceType: balance.type,
                    passthrough: pendingAction.passthrough,
                    token: balance.token,
                  }),
                  { balance, pendingAction },
                ] as const
            )
          )
        )
      : []
  );

type PendingActionAmountValidation =
  | "AboveMaximum"
  | "BelowMinimum"
  | "Required"
  | null;

type PendingActionAmountProjection = Readonly<{
  readonly amount: BigNumber | null;
  readonly validation: PendingActionAmountValidation;
}>;

const setPendingActionAmount = ({
  action,
  current,
  index,
}: {
  readonly action: PendingActionAmountChange["data"];
  readonly current: PositionDetailsWorkflowState["pendingActions"];
  readonly index: ReturnType<typeof getPendingActionIndex>;
}) => {
  const key = getPendingActionStateKey({
    actionType: action.actionType,
    balanceType: action.balanceType,
    passthrough: action.passthrough,
    token: action.token,
  });
  const pending = index.get(key);
  if (!pending) return current;

  const next = new Map(current);
  next.set(key, action.amount);
  return next;
};

const projectPendingActionAmount = ({
  balanceAmount,
  current,
  decimals,
  key,
  pendingAction,
}: {
  readonly balanceAmount: BigNumber;
  readonly current: ReadonlyMap<PendingActionStateKey, BigNumber>;
  readonly decimals: number;
  readonly key: PendingActionStateKey;
  readonly pendingAction: PendingAction;
}): PendingActionAmountProjection => {
  if (!isPendingActionAmountRequired(pendingAction)) {
    return { amount: null, validation: null };
  }

  const config = getPendingActionAmountConfig(pendingAction);
  const configuredMaximum = config?.maximum;
  const maximum =
    configuredMaximum == null || configuredMaximum.isEqualTo(-1)
      ? balanceAmount
      : BigNumber.min(balanceAmount, configuredMaximum);
  const configuredMinimum = config?.minimum;
  const minimum =
    configuredMinimum == null || configuredMinimum.isEqualTo(-1)
      ? exactZero()
      : configuredMinimum;
  const selectedAmount = config?.forceMax
    ? balanceAmount
    : (current.get(key) ??
      BigNumber.max(minimum, BigNumber.min(maximum, balanceAmount)));
  const amount = truncateToTokenDecimals(selectedAmount, decimals);
  const validation = (() => {
    if (!amount.isGreaterThan(0)) return "Required" as const;
    if (amount.isLessThan(minimum)) return "BelowMinimum" as const;
    if (amount.isGreaterThan(maximum)) return "AboveMaximum" as const;
    return null;
  })();

  return { amount, validation };
};

const resolveUnstakeAmount = ({
  canChangeAmount,
  forceMax,
  liveBalance,
  maximum,
  storedAmount,
  useMax,
}: {
  readonly canChangeAmount: boolean | null;
  readonly forceMax: boolean;
  readonly liveBalance: BigNumber | null;
  readonly maximum: BigNumber;
  readonly storedAmount: BigNumber;
  readonly useMax: boolean;
}) => {
  if (useMax) return maximum;
  if (
    liveBalance &&
    canChangeAmount !== null &&
    (!canChangeAmount || forceMax) &&
    !liveBalance.isEqualTo(storedAmount)
  ) {
    return liveBalance;
  }
  return storedAmount;
};

export const positionDetailsWorkflowViewAtom = Atom.family(
  (key: PositionDetailsWorkflowKey) =>
    Atom.make((get) => {
      const yieldId = key.integrationId
        ? Schema.decodeOption(YieldId)(key.integrationId).pipe(Option.getOrNull)
        : null;
      const yieldOpportunity = get(
        yieldOpportunityAtom.foreground(new YieldOpportunityKey({ yieldId }))
      );
      const integrationData = yieldOpportunity.pipe(
        AsyncResult.value,
        Option.getOrNull
      );
      const positionKey = new PositionBalancesKey({
        balanceId: key.balanceId,
        scope: key.scope,
        yieldId,
      });
      const positionBalancesResult = get(positionBalancesAtom(positionKey));
      const positionBalances = positionBalancesResult.pipe(
        AsyncResult.value,
        Option.getOrNull
      );
      const positionBalancesByType = get(
        positionBalancesByTypeAtom(positionKey)
      ).pipe(AsyncResult.value, Option.getOrNull);
      const stakedOrLiquidBalances =
        positionBalancesByType?.get("active") ?? null;
      const firstBalance = stakedOrLiquidBalances?.[0] ?? null;
      const reducedStakedOrLiquidBalance = firstBalance
        ? (stakedOrLiquidBalances?.reduce(
            (total, balance) => ({
              amount: total.amount.plus(balance.amount),
              amountUsd: total.amountUsd.plus(balance.amountUsd ?? 0),
              token: balance.token,
            }),
            {
              amount: exactZero(),
              amountUsd: exactZero(),
              token: firstBalance.token,
            }
          ) ?? null)
        : null;
      const amountConstraints = getYieldAmountConstraints({
        availableAmount: reducedStakedOrLiquidBalance?.amount ?? null,
        pricePerShare: null,
        type: "exit",
        yield: integrationData,
      });
      const canChangeUnstakeAmount = integrationData
        ? !amountConstraints.forceMax &&
          (Boolean(
            getYieldActionArg(integrationData, "exit", "amount")?.required
          ) ||
            isERC4626(integrationData))
        : null;
      const workflow = get(positionDetailsWorkflowAtom(key));
      const exitReceiveTokenSelection = integrationData
        ? resolvePositionDetailsExitReceiveTokenSelection({
            integration: integrationData,
            selectedAddress: workflow.exitReceiveTokenAddress,
          })
        : null;
      const resolvedUnstakeAmount = resolveUnstakeAmount({
        canChangeAmount: canChangeUnstakeAmount,
        forceMax: amountConstraints.forceMax,
        liveBalance: reducedStakedOrLiquidBalance?.amount ?? null,
        maximum: amountConstraints.allowedMaximum,
        storedAmount: workflow.unstakeAmount,
        useMax: workflow.unstakeUseMaxAmount,
      });
      const unstakeDecimals =
        reducedStakedOrLiquidBalance?.token.decimals ??
        integrationData?.token.decimals;
      const unstakeAmount =
        unstakeDecimals == null
          ? resolvedUnstakeAmount
          : truncateToTokenDecimals(resolvedUnstakeAmount, unstakeDecimals);
      const unstakeIsGreaterThanMax = unstakeAmount.isGreaterThan(
        amountConstraints.allowedMaximum
      );
      const unstakeIsLessThanMin = unstakeAmount.isLessThan(
        amountConstraints.allowedMinimum
      );
      const unstakeIsGreaterOrLessIntegrationLimitError =
        (amountConstraints.maximum
          ? unstakeAmount.isGreaterThan(amountConstraints.maximum)
          : false) || unstakeIsLessThanMin;
      const unstakeAmountError =
        (!unstakeAmount.isZero() && unstakeIsLessThanMin) ||
        unstakeIsGreaterThanMax ||
        unstakeIsGreaterOrLessIntegrationLimitError;
      const pendingActionIndex = getPendingActionIndex(positionBalancesByType);
      const pendingActionProjections = new Map(
        [...pendingActionIndex].map(([pendingKey, pending]) => [
          pendingKey,
          projectPendingActionAmount({
            balanceAmount: pending.balance.amount,
            current: workflow.pendingActions,
            decimals: pending.balance.token.decimals,
            key: pendingKey,
            pendingAction: pending.pendingAction,
          }),
        ])
      );
      const pendingActions = new Map(
        [...pendingActionProjections].flatMap(([pendingKey, projection]) =>
          projection.amount ? [[pendingKey, projection.amount] as const] : []
        )
      );
      return {
        ...workflow,
        canChangeUnstakeAmount,
        currentWalletScope: key.scope,
        exitReceiveTokenSelection,
        integrationData,
        maxUnstakeAmount: amountConstraints.allowedMaximum,
        minUnstakeAmount: amountConstraints.allowedMinimum,
        pendingActionIndex,
        pendingActionProjections,
        pendingActions,
        pendingActionType: key.pendingActionType,
        positionBalances,
        positionBalancesByType,
        positionBalancesResult,
        reducedStakedOrLiquidBalance,
        stakedOrLiquidBalances,
        unstakeAmount,
        unstakeAmountError,
        unstakeForceMaxAmount: amountConstraints.forceMax,
        unstakeAmountValid:
          unstakeAmount.isGreaterThanOrEqualTo(
            amountConstraints.allowedMinimum
          ) &&
          unstakeAmount.isLessThanOrEqualTo(amountConstraints.allowedMaximum) &&
          !unstakeAmount.isZero(),
        unstakeIsGreaterOrLessIntegrationLimitError,
        unstakeToken: firstBalance?.token ?? null,
        yieldOpportunity,
      } as const;
    }).pipe(Atom.withLabel("positionDetailsWorkflowViewAtom"))
);

export const dispatchPositionDetailsWorkflowAtom = Atom.family(
  (key: PositionDetailsWorkflowKey) =>
    Atom.fnSync((action: PositionDetailsWorkflowAction, context) => {
      const view = context(positionDetailsWorkflowViewAtom(key));
      const pendingActions =
        action.type === "pendingAction/amount/change"
          ? setPendingActionAmount({
              action: action.data,
              current: view.pendingActions,
              index: view.pendingActionIndex,
            })
          : undefined;
      context.set(
        positionDetailsWorkflowAtom(key),
        reducePositionDetailsWorkflow({
          action,
          maxUnstakeAmount: view.maxUnstakeAmount,
          pendingActions,
          state: {
            exitReceiveTokenAddress: view.exitReceiveTokenAddress,
            pendingActions: view.pendingActions,
            unstakeAmount: view.unstakeAmount,
            unstakeUseMaxAmount: view.unstakeUseMaxAmount,
          },
        })
      );
    })
);

type PricedEarnBalance =
  PositionBalancesByType extends Map<unknown, Array<infer Balance>>
    ? Balance
    : never;

type PositionDetailsPendingActionView = {
  readonly amount: BigNumber | null;
  readonly formattedAmount: string;
  readonly pendingAction: PendingAction;
  readonly validation: PendingActionAmountValidation;
  readonly yieldBalance: PricedEarnBalance;
};

export const positionDetailsPricesAtom = Atom.family(
  (key: PositionDetailsWorkflowKey) =>
    Atom.make((get) => {
      const view = get(positionDetailsWorkflowViewAtom(key));
      const baseToken = view.integrationData?.token ?? null;
      return get(
        pricesAtom.foreground(
          new PricesKey({
            request:
              view.positionBalances && baseToken
                ? {
                    currency: config.currency,
                    tokenList: [
                      baseToken,
                      ...view.positionBalances.balances.map(
                        (balance) => balance.token
                      ),
                    ],
                  }
                : null,
          })
        )
      );
    }).pipe(Atom.withLabel("positionDetailsPricesAtom"))
);

export const positionDetailsPendingActionsViewAtom = Atom.family(
  (key: PositionDetailsWorkflowKey) =>
    Atom.make((get): PositionDetailsPendingActionView[] | null => {
      const view = get(positionDetailsWorkflowViewAtom(key));
      const baseToken = view.integrationData?.token ?? null;
      const prices = get(positionDetailsPricesAtom(key)).pipe(
        AsyncResult.value,
        Option.getOrNull
      );
      return view.positionBalancesByType
        ? [...view.positionBalancesByType.values()].flatMap((balances) =>
            balances.flatMap((balance) =>
              balance.pendingActions.map((pendingAction) => {
                const pendingKey = getPendingActionStateKey({
                  actionType: pendingAction.type,
                  balanceType: balance.type,
                  passthrough: pendingAction.passthrough,
                  token: balance.token,
                });
                const projection =
                  view.pendingActionProjections.get(pendingKey);
                const amount = projection?.amount ?? null;
                const formattedAmount =
                  prices &&
                  amount &&
                  view.reducedStakedOrLiquidBalance &&
                  baseToken
                    ? formatUsd(
                        getTokenPriceInUSD({
                          amount,
                          baseToken,
                          pricePerShare: null,
                          prices,
                          token: view.reducedStakedOrLiquidBalance.token,
                        })
                      )
                    : "";
                return {
                  amount,
                  formattedAmount,
                  pendingAction,
                  validation: projection?.validation ?? null,
                  yieldBalance: balance,
                };
              })
            )
          )
        : null;
    }).pipe(Atom.withLabel("positionDetailsPendingActionsViewAtom"))
);
