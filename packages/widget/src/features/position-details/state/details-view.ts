import type BigNumber from "bignumber.js";
import { Equal } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";

import {
  type ConfidentialHandle,
  getVisibleShares,
} from "../../../domain/earn/balance";
import { isConfidentialYield } from "../../../domain/earn/confidential";
import { isUserRevealableBalance } from "../../../domain/earn/confidential-balance";
import { getPositionRate } from "../../../domain/earn/position-rate";
import { isForceMaxAmount } from "../../../domain/earn/stake";
import { getYieldActionArg } from "../../../domain/earn/yield";
import { exactDecimal } from "../../../domain/finance/exact";
import { type TokenString, tokenString } from "../../../domain/token/token";
import { walletScopeOwnerKey } from "../../../domain/wallet/wallet-scope";
import {
  InFlightCancelsKey,
  inFlightCancelsResourceAtom,
} from "../../../resources/in-flight-cancels/in-flight-cancels";
import {
  PositionCampaignRewardsKey,
  positionCanEarnCampaignAtom,
  yieldCampaignAtom,
} from "../../campaigns/index";
import { YieldSummaryKey, yieldSummaryAtom } from "../../yield-summary/index";
import { resolvePositionDetailsPageState } from "../model/page-state";
import { positionDetailsExitActions } from "./actions/exit";
import {
  loadMorePositionDetailsExitValidatorsAtom,
  PositionDetailsExitResourcesKey,
  positionDetailsExitResourcesViewAtom,
  refreshPositionDetailsExitKycAtom,
} from "./exit-resources";
import { retryPositionDetailsLoad } from "./retry";
import type { PositionDetailsWorkflowKey } from "./workflow";
import {
  dispatchPositionDetailsWorkflowAtom,
  positionDetailsWorkflowViewAtom,
} from "./workflow-view";

export type PositionDetailsShareConversion = {
  readonly rate: BigNumber;
  readonly shareSymbol: string | undefined;
  readonly symbol: string;
};

/**
 * Why the exit cannot run yet, the first the user can act on, as the Stake
 * button's blocker reads: the exit's call to action says it in place of the
 * verb while disabled.
 */
export type PositionDetailsExitBlocker =
  | "AboveMaximum"
  | "BelowMinimum"
  | "EnterAmount"
  | "InsufficientBalance"
  | "VerifyIdentity";

const getExitBlocker = ({
  amount,
  amountError,
  amountGreaterThanAvailable,
  kycBlocking,
  minimum,
}: {
  readonly amount: BigNumber;
  /** Below the minimum or above the maximum the exit allows. */
  readonly amountError: boolean;
  readonly amountGreaterThanAvailable: boolean;
  readonly kycBlocking: boolean;
  readonly minimum: BigNumber;
}): PositionDetailsExitBlocker | null => {
  if (kycBlocking) return "VerifyIdentity";
  if (amount.isZero()) return "EnterAmount";
  if (amountGreaterThanAvailable) return "InsufficientBalance";
  if (amount.isLessThan(minimum)) return "BelowMinimum";
  return amountError ? "AboveMaximum" : null;
};

/** The share of `value` that `part` of `whole` holds. */
const prorate = ({
  part,
  value,
  whole,
}: {
  readonly part: BigNumber;
  readonly value: BigNumber;
  readonly whole: BigNumber;
}) =>
  whole.isZero() ? exactDecimal(0) : value.dividedBy(whole).multipliedBy(part);

const getExitResourcesKey = (
  view: Atom.Type<ReturnType<typeof positionDetailsWorkflowViewAtom>>
) =>
  new PositionDetailsExitResourcesKey({
    yieldId: view.integrationData?.id ?? null,
  });

export const positionDetailsViewAtom = Atom.family(
  (key: PositionDetailsWorkflowKey) =>
    Atom.make((get) => {
      const workflow = get(positionDetailsWorkflowViewAtom(key));
      const integration = workflow.integrationData;
      const amountArgument = integration
        ? getYieldActionArg(integration, "exit", "amount")
        : null;
      const forceMax = amountArgument
        ? isForceMaxAmount(amountArgument)
        : false;
      const minimum = workflow.minUnstakeAmount;
      const exitResources = get(
        positionDetailsExitResourcesViewAtom(getExitResourcesKey(workflow))
      );
      const providers = get(
        yieldSummaryAtom(
          new YieldSummaryKey({
            validators:
              workflow.positionBalances?.type === "validators"
                ? workflow.positionBalances.validators
                : null,
            yield: integration,
          })
        )
      ).providers;
      // The campaign checks read their atoms only when the rate has a
      // campaign part, so other positions neither load nor follow campaigns.
      const positionRate = integration
        ? getPositionRate({
            balanceRewardRate: workflow.positionBalances?.rewardRate ?? null,
            getShownCampaign: () =>
              get(yieldCampaignAtom(integration.id))?.campaign ?? null,
            canEarnCampaign: () =>
              get(
                positionCanEarnCampaignAtom(
                  new PositionCampaignRewardsKey({
                    scope: key.scope,
                    yieldId: integration.id,
                  })
                )
              ),
            validators:
              workflow.positionBalances?.type === "validators"
                ? workflow.positionBalances.validators
                : null,
            yieldRewardRate: integration.rewardRate,
          })
        : null;
      const shareToAmountConversions =
        integration && workflow.positionBalancesByType
          ? [...workflow.positionBalancesByType.values()].reduce(
              (conversions, balances) => {
                balances.forEach((balance) => {
                  const shareAmount = getVisibleShares(balance)?.amount;
                  if (!shareAmount || balance.token.isPoints) return;
                  conversions.set(tokenString(balance.token), {
                    rate: shareAmount.dividedBy(balance.amount),
                    shareSymbol: balance.shareToken?.symbol,
                    symbol: balance.token.symbol,
                  });
                });
                return conversions;
              },
              new Map<TokenString, PositionDetailsShareConversion>()
            )
          : null;
      const canUnstake = Boolean(integration?.status.exit);
      const positionBalances = [
        ...(workflow.positionBalancesByType?.values() ?? []),
      ].flat();
      const hasHiddenBalances = positionBalances.some(isUserRevealableBalance);
      // Only a confidential vault's pending balances can be mid-cancel. Read
      // locally: a failed lookup, even after an earlier success, just leaves
      // them looking pending.
      const inFlightCancels =
        integration &&
        isConfidentialYield(integration) &&
        positionBalances.some(
          (balance) => balance.type === "entering" || balance.type === "exiting"
        )
          ? get(
              inFlightCancelsResourceAtom.local(
                new InFlightCancelsKey({
                  scope: walletScopeOwnerKey(key.scope),
                  yieldId: integration.id,
                })
              )
            )
          : null;
      const cancellingHandles: ReadonlySet<ConfidentialHandle> =
        inFlightCancels && AsyncResult.isSuccess(inFlightCancels)
          ? inFlightCancels.value
          : new Set();
      const action = get(positionDetailsExitActions.view(key));
      const submittedBelowMinimum =
        action.submissionError &&
        workflow.unstakeAmount.isLessThan(workflow.minUnstakeAmount);
      const unstakeBlocker = getExitBlocker({
        amount: workflow.unstakeAmount,
        amountError: workflow.unstakeAmountError,
        amountGreaterThanAvailable: workflow.unstakeAmountGreaterThanAvailable,
        kycBlocking: exitResources.kyc.isBlocking,
        minimum,
      });

      return {
        hasHiddenBalances,
        hasRevealedBalances:
          Boolean(integration && isConfidentialYield(integration)) &&
          !hasHiddenBalances &&
          positionBalances.some(
            (balance) => !balance.isEncrypted && balance.type !== "withdrawable"
          ),
        cancellingHandles,
        canChangeUnstakeAmount: workflow.canChangeUnstakeAmount,
        canUnstake,
        exitBalance: workflow.exitBalance,
        exitReceiveTokenSelection: workflow.exitReceiveTokenSelection,
        hasMoreValidators: exitResources.hasMoreValidators,
        positionSource:
          workflow.positionBalances?.type === "validators"
            ? ("validator" as const)
            : ("yield" as const),
        integrationData: integration,
        isLoadingMoreValidators: exitResources.isLoadingMoreValidators,
        kycGate: exitResources.kyc.gate,
        kycGateIsChecking: exitResources.kyc.isChecking,
        kycProviderName: exitResources.kyc.providerName,
        page: resolvePositionDetailsPageState({
          position: workflow.positionResult,
          validatorsLoading: exitResources.isValidatorsLoading,
          yieldOpportunity: workflow.yieldResult,
        }),
        positionBalancesByType: workflow.positionBalancesByType,
        providersDetails: providers,
        positionRate,
        shareToAmountConversions,
        unstakeAmount: workflow.unstakeAmount,
        unstakeAmountError:
          action.submissionError || workflow.unstakeAmountError,
        unstakeAmountGreaterThanAvailable:
          workflow.unstakeAmountGreaterThanAvailable,
        unstakeBlocker,
        // An empty or out-of-range amount cannot be submitted; the call to
        // action says why (`unstakeBlocker`), as Stake's does.
        unstakeDisabled:
          workflow.yieldResult._tag !== "Ready" ||
          !canUnstake ||
          unstakeBlocker !== null,
        unstakeAmountUsd: workflow.exitBalance
          ? prorate({
              part: workflow.unstakeAmount,
              value: workflow.exitBalance.amountUsd,
              whole: workflow.exitBalance.amount,
            })
          : null,
        // An exit in Shares, restated in the Value Token it redeems to.
        unstakeAmountValue: workflow.exitBalance?.value
          ? {
              amount: prorate({
                part: workflow.unstakeAmount,
                value: workflow.exitBalance.value.amount,
                whole: workflow.exitBalance.amount,
              }),
              token: workflow.exitBalance.value.token,
            }
          : null,
        unstakeIsGreaterOrLessIntegrationLimitError:
          workflow.unstakeIsGreaterOrLessIntegrationLimitError ||
          submittedBelowMinimum,
        unstakeMaxAmount:
          amountArgument && !forceMax ? (amountArgument.maximum ?? null) : null,
        unstakeMinAmount:
          amountArgument && !forceMax && minimum.isGreaterThan(0)
            ? minimum
            : null,
        unstakeToken: workflow.unstakeToken,
        validatorsData: exitResources.validators,
      } as const;
    }).pipe(Atom.withLabel("positionDetailsViewAtom"))
);

/**
 * What the position's summary card and Details read, and nothing of the exit
 * form: with structural equality, typing an amount leaves it equal, so the
 * page's right pane does not render again per keystroke.
 */
export const positionOverviewViewAtom = Atom.family(
  (key: PositionDetailsWorkflowKey) =>
    Atom.make((get) => {
      const {
        cancellingHandles,
        integrationData,
        positionBalancesByType,
        positionRate,
      } = get(positionDetailsViewAtom(key));
      return {
        cancellingHandles,
        integrationData,
        positionBalancesByType,
        positionRate,
      } as const;
    }).pipe(
      Atom.withEquality(Equal.equals),
      Atom.withLabel("positionOverviewViewAtom")
    )
);

export const setPositionDetailsExitAmountAtom = Atom.family(
  (key: PositionDetailsWorkflowKey) =>
    Atom.fnSync((amount: BigNumber, context) =>
      context.set(dispatchPositionDetailsWorkflowAtom(key), {
        type: "unstake/amount/change",
        data: amount,
      })
    )
);

export const loadMorePositionDetailsValidatorsAtom = Atom.family(
  (key: PositionDetailsWorkflowKey) =>
    Atom.fnSync(
      (_input: undefined, context) => {
        const workflow = context(positionDetailsWorkflowViewAtom(key));
        context.set(
          loadMorePositionDetailsExitValidatorsAtom(
            getExitResourcesKey(workflow)
          ),
          undefined
        );
      },
      { initialValue: undefined }
    )
);

export const refreshPositionDetailsKycAtom = Atom.family(
  (key: PositionDetailsWorkflowKey) =>
    Atom.fnSync(
      (_input: undefined, context) => {
        const workflow = context(positionDetailsWorkflowViewAtom(key));
        context.set(
          refreshPositionDetailsExitKycAtom(getExitResourcesKey(workflow)),
          undefined
        );
      },
      { initialValue: undefined }
    )
);

/** Loads the position's page again after its first load failed. */
export const retryPositionDetailsAtom = Atom.family(
  (key: PositionDetailsWorkflowKey) =>
    Atom.fnSync(
      (_input: undefined, context) =>
        retryPositionDetailsLoad(context, {
          scope: key.scope,
          yieldId: key.integrationId,
        }),
      { initialValue: undefined }
    )
);

export const positionDetailsExitNetworkFeeAtom =
  positionDetailsExitActions.networkFee;
export const setPositionDetailsExitMaxAmountAtom =
  positionDetailsExitActions.setMaxAmount;
export const setPositionDetailsExitReceiveTokenAtom =
  positionDetailsExitActions.setReceiveToken;
export const submitPositionDetailsExitAtom = positionDetailsExitActions.submit;
