import BigNumber from "bignumber.js";
import { Option, Schema } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { getPendingActionStateKey } from "../../../domain/action/action-command";
import type { PendingAction } from "../../../domain/action/models";
import {
  getPendingActionAmountConfig,
  isPendingActionAmountRequired,
} from "../../../domain/action/pending-action";
import { getYieldActionArg, isERC4626 } from "../../../domain/earn/yield";
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

const clampPendingActionAmount = ({
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
  const amountConfig = getPendingActionAmountConfig(pending.pendingAction);
  const maximum = new BigNumber(
    amountConfig?.maximum ?? Number.POSITIVE_INFINITY
  );
  const minimum = new BigNumber(amountConfig?.minimum ?? 0);
  const amount = amountConfig?.forceMax
    ? new BigNumber(pending.balance.amount)
    : BigNumber.max(minimum, BigNumber.min(maximum, action.amount));
  next.set(key, amount);
  return next;
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
              amount: new BigNumber(0),
              amountUsd: new BigNumber(0),
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
      const unstakeAmount =
        reducedStakedOrLiquidBalance &&
        canChangeUnstakeAmount !== null &&
        (!canChangeUnstakeAmount || amountConstraints.forceMax) &&
        !reducedStakedOrLiquidBalance.amount.isEqualTo(workflow.unstakeAmount)
          ? reducedStakedOrLiquidBalance.amount
          : workflow.unstakeAmount;
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
      return {
        ...workflow,
        canChangeUnstakeAmount,
        currentWalletScope: key.scope,
        exitReceiveTokenSelection,
        integrationData,
        maxUnstakeAmount: amountConstraints.allowedMaximum,
        minUnstakeAmount: amountConstraints.allowedMinimum,
        pendingActionIndex: getPendingActionIndex(positionBalancesByType),
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
          ? clampPendingActionAmount({
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
                const amount = isPendingActionAmountRequired(pendingAction)
                  ? (view.pendingActions.get(
                      getPendingActionStateKey({
                        actionType: pendingAction.type,
                        balanceType: balance.type,
                        passthrough: pendingAction.passthrough,
                        token: balance.token,
                      })
                    ) ?? new BigNumber(0))
                  : null;
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
                  yieldBalance: balance,
                };
              })
            )
          )
        : null;
    }).pipe(Atom.withLabel("positionDetailsPendingActionsViewAtom"))
);
