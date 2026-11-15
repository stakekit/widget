import BigNumber from "bignumber.js";
import { Option } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";

import { getPendingActionStateKey } from "../../../domain/action/action-command";
import {
  getExitUnit,
  getSharesExitBalance,
  type SharesExitBalance,
} from "../../../domain/earn/denomination";
import { isYieldActionAmountEditable } from "../../../domain/earn/stake";
import type { EarnYieldWithProvider } from "../../../domain/earn/yield-schema";
import { truncateToTokenDecimals } from "../../../domain/finance/exact";
import { getTokenPriceInUSD } from "../../../domain/finance/price";
import {
  getSingleExitTokenSum,
  type PositionBalancesByType,
  type PositionTokenSum,
} from "../../../domain/portfolio/positions";
import { PricesKey, pricesAtom } from "../../../resources/token-prices/prices";
import {
  YieldOpportunityKey,
  yieldOpportunityAtom,
} from "../../../resources/yield-opportunity/provider";
import {
  PositionBalancesKey,
  positionBalancesAtom,
  positionBalancesByTypeAtom,
} from "../../../resources/yield-positions/yield-positions";
import { config } from "../../../shared/config/widget-defaults";
import {
  presentedValue,
  toPresentable,
} from "../../../shared/effect/async-result";
import {
  getYieldAmountConstraints,
  getYieldEntryPriceToken,
} from "../../yield-entry/index";
import { resolvePositionDetailsExitReceiveTokenSelection } from "../model/exit-receive-token";
import {
  getPendingActionOffers,
  type PendingActionOffer,
} from "../model/pending-action-offers";
import type { PricesStatus } from "../model/priced-fiat";
import {
  type PendingActionAmountChange,
  type PositionDetailsWorkflowAction,
  type PositionDetailsWorkflowKey,
  type PositionDetailsWorkflowState,
  positionDetailsWorkflowAtom,
  reducePositionDetailsWorkflow,
} from "./workflow";

/** Keeps an entered amount only for an action the position offers. */
const setPendingActionAmount = ({
  action,
  current,
  offers,
}: {
  readonly action: PendingActionAmountChange["data"];
  readonly current: PositionDetailsWorkflowState["pendingActions"];
  readonly offers: ReadonlyArray<PendingActionOffer<PricedEarnBalance>>;
}) => {
  const key = getPendingActionStateKey({
    actionType: action.actionType,
    balanceType: action.balanceType,
    passthrough: action.passthrough,
    token: action.token,
  });
  if (!offers.some((offer) => offer.key === key)) return current;

  const next = new Map(current);
  next.set(key, action.amount);
  return next;
};

/** An exit in Shares also carries its value in the Value Token. */
type ExitBalance = PositionTokenSum & Partial<Pick<SharesExitBalance, "value">>;

const getExitBalance = (
  integration: EarnYieldWithProvider | null,
  activeBalances: Parameters<typeof getSingleExitTokenSum>[0] &
    Parameters<typeof getSharesExitBalance>[0]
): ExitBalance | null =>
  integration && getExitUnit(integration, activeBalances) === "shares"
    ? getSharesExitBalance(activeBalances)
    : getSingleExitTokenSum(activeBalances);

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
      const yieldId = key.integrationId;
      const yieldResult = toPresentable(
        get(
          yieldOpportunityAtom.foreground(new YieldOpportunityKey({ yieldId }))
        )
      );
      const integrationData = presentedValue(yieldResult);
      const positionKey = new PositionBalancesKey({
        balanceId: key.balanceId,
        scope: key.scope,
        yieldId,
      });
      const positionResult = toPresentable(
        get(positionBalancesAtom(positionKey))
      );
      const positionBalances = presentedValue(positionResult);
      const positionBalancesByType = presentedValue(
        toPresentable(get(positionBalancesByTypeAtom(positionKey)))
      );
      const stakedOrLiquidBalances =
        positionBalancesByType?.get("active") ?? null;
      // Several active token identities have no scalar exit amount; exit is
      // then unavailable rather than built from a mixed-token sum.
      const exitBalance = stakedOrLiquidBalances
        ? getExitBalance(integrationData, stakedOrLiquidBalances)
        : null;
      const amountConstraints = getYieldAmountConstraints({
        availableAmount: exitBalance?.amount ?? null,
        pricePerShare: null,
        type: "exit",
        yield: integrationData,
      });
      const canChangeUnstakeAmount = integrationData
        ? isYieldActionAmountEditable(integrationData, "exit")
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
        liveBalance: exitBalance?.amount ?? null,
        maximum: amountConstraints.allowedMaximum,
        storedAmount: workflow.unstakeAmount,
        useMax: workflow.unstakeUseMaxAmount,
      });
      const unstakeDecimals =
        exitBalance?.token.decimals ?? integrationData?.token.decimals;
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
      const unstakeIsLessThanMinForDisplay =
        !unstakeAmount.isZero() && unstakeIsLessThanMin;
      const unstakeIsGreaterOrLessIntegrationLimitError =
        (amountConstraints.maximum
          ? unstakeAmount.isGreaterThan(amountConstraints.maximum)
          : false) || unstakeIsLessThanMinForDisplay;
      const unstakeAmountError =
        unstakeIsLessThanMinForDisplay || unstakeIsGreaterThanMax;
      // Distinct from the integration min/max: the amount is more than the
      // position holds.
      const unstakeAmountGreaterThanAvailable = exitBalance
        ? unstakeAmount.isGreaterThan(exitBalance.amount)
        : false;
      const pendingActionOffers = getPendingActionOffers({
        balances: [...(positionBalancesByType?.values() ?? [])].flat(),
        enteredAmounts: workflow.pendingActions,
      });
      const pendingActions = new Map(
        pendingActionOffers.flatMap((offer) =>
          offer.amount ? [[offer.key, offer.amount] as const] : []
        )
      );
      return {
        ...workflow,
        canChangeUnstakeAmount,
        currentWalletScope: key.scope,
        exitBalance,
        exitReceiveTokenSelection,
        integrationData,
        maxUnstakeAmount: amountConstraints.allowedMaximum,
        minUnstakeAmount: amountConstraints.allowedMinimum,
        pendingActionOffers,
        pendingActions,
        pendingActionType: key.pendingActionType,
        positionBalances,
        positionBalancesByType,
        positionResult,
        stakedOrLiquidBalances,
        unstakeAmount,
        unstakeAmountError,
        unstakeAmountGreaterThanAvailable,
        unstakeForceMaxAmount: amountConstraints.forceMax,
        unstakeAmountValid:
          unstakeAmount.isGreaterThanOrEqualTo(
            amountConstraints.allowedMinimum
          ) &&
          unstakeAmount.isLessThanOrEqualTo(amountConstraints.allowedMaximum) &&
          !unstakeAmount.isZero(),
        unstakeIsGreaterOrLessIntegrationLimitError,
        unstakeToken: exitBalance?.token ?? null,
        yieldResult,
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
              offers: view.pendingActionOffers,
            })
          : undefined;
      context.set(
        positionDetailsWorkflowAtom(key),
        reducePositionDetailsWorkflow({
          action,
          maxUnstakeAmount: view.maxUnstakeAmount,
          ...(pendingActions === undefined ? {} : { pendingActions }),
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

type PositionDetailsPendingActionView = PendingActionOffer<PricedEarnBalance> &
  Readonly<{
    readonly amountUsd: BigNumber | null;
    /** Whether the prices that value `amount` are in, so `amountUsd` is too. */
    readonly amountUsdStatus: PricesStatus;
  }>;

export const positionDetailsPricesAtom = Atom.family(
  (key: PositionDetailsWorkflowKey) =>
    Atom.make((get) => {
      const { integrationData, positionBalances } = get(
        positionDetailsWorkflowViewAtom(key)
      );
      return get(
        pricesAtom.foreground(
          new PricesKey({
            request:
              positionBalances && integrationData
                ? {
                    currency: config.currency,
                    tokenList: [
                      integrationData.token,
                      // Values the exit's estimated network fee.
                      integrationData.mechanics.gasFeeToken,
                      ...positionBalances.balances.map(
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
      const pricesResult = get(positionDetailsPricesAtom(key));
      const amountUsdStatus = toPresentable(pricesResult)._tag;
      const prices = pricesResult.pipe(AsyncResult.value, Option.getOrNull);
      return view.positionBalancesByType
        ? view.pendingActionOffers.map((offer) => ({
            ...offer,
            // Encrypted rows carry the unpriced confidential asset.
            amountUsd:
              prices && offer.amount && baseToken
                ? getTokenPriceInUSD({
                    amount: offer.amount,
                    baseToken,
                    pricePerShare: null,
                    prices,
                    token:
                      getYieldEntryPriceToken(
                        view.integrationData,
                        offer.yieldBalance.token
                      ) ?? offer.yieldBalance.token,
                  })
                : null,
            amountUsdStatus,
          }))
        : null;
    }).pipe(Atom.withLabel("positionDetailsPendingActionsViewAtom"))
);
